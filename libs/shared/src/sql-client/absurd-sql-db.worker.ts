/// <reference lib="webworker" />
/// <reference path="./absurd-sql-modules.d.ts" />

/** Browser/worker build — avoids Node `fs`/`path` branches in `sql-wasm.js`. */
import initSqlJs from '@jlongster/sql.js/dist/worker.sql-wasm.js';
import { SQLiteFS } from 'absurd-sql';
import IndexedDBBackend from 'absurd-sql/dist/indexeddb-backend';

type SqlJsBindParams = unknown[] | Record<string, unknown> | null | undefined;

type WorkerInboundMessage = {
  id: number;
  op:
    | 'connect'
    | 'disconnect'
    | 'query'
    | 'run'
    | 'txBegin'
    | 'txCommit'
    | 'txRollback';
  payload?: {
    databaseName?: string;
    sql?: string;
    params?: unknown[];
  };
};

type WorkerOutboundMessage =
  | { id: number; ok: true; result?: unknown }
  | { id: number; ok: false; error: string };

declare const self: DedicatedWorkerGlobalScope;

let SQL: any = null;
let sqlDatabase: any = null;
let txDepth = 0;

function postReply(msg: WorkerOutboundMessage): void {
  self.postMessage(msg);
}

function readRunMeta(db: any): { changes: number; lastInsertRowid: number } {
  const stmt = db.prepare('SELECT changes() AS c, last_insert_rowid() AS r');
  try {
    stmt.step();
    const row = stmt.getAsObject() as { c: number; r: number };
    return {
      changes: Number(row.c ?? 0),
      lastInsertRowid: Number(row.r ?? 0),
    };
  } finally {
    stmt.free();
  }
}

function rowsFromStatement(stmt: any): Record<string, unknown>[] {
  const columns = stmt.getColumnNames();
  const rows: Record<string, unknown>[] = [];
  while (stmt.step()) {
    const values = stmt.get() as unknown[];
    const row: Record<string, unknown> = {};
    for (let i = 0; i < columns.length; i++) {
      const col = columns[i];
      if (col === undefined) {
        throw new Error('sql.js: column name missing for result row');
      }
      row[col] = values[i];
    }
    rows.push(row);
  }
  return rows;
}

async function ensureDb(databaseName: string): Promise<void> {
  if (sqlDatabase !== null) {
    return;
  }
  SQL = await initSqlJs({
    locateFile: (file: string) => new URL(file, self.location.href).href,
  });

  const sqlFS = new SQLiteFS(SQL.FS, new IndexedDBBackend());
  const sqlWithIdb = SQL as unknown as {
    register_for_idb: (fs: SQLiteFS) => void;
  };
  sqlWithIdb.register_for_idb(sqlFS);

  SQL.FS.mkdir('/sql');
  SQL.FS.mount(sqlFS, {}, '/sql');

  const path = `/sql/${databaseName}.sqlite`;
  if (typeof SharedArrayBuffer === 'undefined') {
    const stream = SQL.FS.open(path, 'a+');
    await stream.node.contents.readIfFallback();
    SQL.FS.close(stream);
  }

  sqlDatabase = new SQL.Database(path, { filename: true });
  sqlDatabase.exec('PRAGMA journal_mode=MEMORY;');
}

async function handleMessage(msg: WorkerInboundMessage): Promise<void> {
  const { id, op, payload } = msg;

  if (op === 'connect') {
    const databaseName = payload?.databaseName;
    if (typeof databaseName !== 'string' || databaseName.length === 0) {
      postReply({ id, ok: false, error: 'connect: missing databaseName' });
      return;
    }
    await ensureDb(databaseName);
    postReply({ id, ok: true });
    return;
  }

  if (op === 'disconnect') {
    if (sqlDatabase !== null) {
      try {
        sqlDatabase.close();
      } catch {
        // ignore
      }
      sqlDatabase = null;
    }
    SQL = null;
    txDepth = 0;
    postReply({ id, ok: true });
    return;
  }

  if (sqlDatabase === null) {
    postReply({ id, ok: false, error: 'Database not connected' });
    return;
  }

  const db = sqlDatabase;

  if (op === 'txBegin') {
    if (txDepth > 0) {
      postReply({
        id,
        ok: false,
        error: 'Nested transactions are not supported for absurd-sql worker',
      });
      return;
    }
    db.run('BEGIN');
    txDepth = 1;
    postReply({ id, ok: true });
    return;
  }

  if (op === 'txCommit') {
    if (txDepth !== 1) {
      postReply({ id, ok: false, error: 'txCommit: not in transaction' });
      return;
    }
    db.run('COMMIT');
    txDepth = 0;
    postReply({ id, ok: true });
    return;
  }

  if (op === 'txRollback') {
    if (txDepth !== 1) {
      txDepth = 0;
      postReply({ id, ok: true });
      return;
    }
    db.run('ROLLBACK');
    txDepth = 0;
    postReply({ id, ok: true });
    return;
  }

  const sql = payload?.sql;
  if (typeof sql !== 'string') {
    postReply({ id, ok: false, error: 'Missing sql' });
    return;
  }
  const params = payload?.params ?? [];

  if (op === 'query') {
    const stmt = db.prepare(sql);
    try {
      stmt.bind(params as SqlJsBindParams);
      const rows = rowsFromStatement(stmt);
      postReply({ id, ok: true, result: rows });
    } finally {
      stmt.free();
    }
    return;
  }

  if (op === 'run') {
    const stmt = db.prepare(sql);
    try {
      if (params.length > 0) {
        stmt.bind(params as SqlJsBindParams);
      }
      stmt.step();
    } finally {
      stmt.free();
    }
    postReply({ id, ok: true, result: readRunMeta(db) });
    return;
  }

  postReply({ id, ok: false, error: `Unknown op: ${String(op)}` });
}

self.onmessage = (ev: MessageEvent<WorkerInboundMessage>) => {
  const data = ev.data;
  void handleMessage(data).catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    postReply({ id: data.id, ok: false, error: message });
  });
};
