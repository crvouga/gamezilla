import type { Database, SqlValue } from '@sqlite.org/sqlite-wasm';
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';

import { reportFetch } from '../wall';

export type FrameSqliteHandle = {
  readonly sha256: string;
  readonly db: Database;
  close(): void;
};

type Sqlite3Module = Awaited<ReturnType<typeof sqlite3InitModule>>;

let modulePromise: Promise<Sqlite3Module> | undefined;

function loadSqlite3(): Promise<Sqlite3Module> {
  if (!modulePromise) {
    // New package API takes no config; wasm resolves next to the module.
    // We also copy assets to /sqlite-wasm/ for the SPA static server.
    modulePromise = sqlite3InitModule();
  }
  return modulePromise;
}

export async function gunzipBytes(gzipped: Uint8Array): Promise<Uint8Array> {
  const ab = new ArrayBuffer(gzipped.byteLength);
  new Uint8Array(ab).set(gzipped);
  const stream = new Blob([ab])
    .stream()
    .pipeThrough(new DecompressionStream('gzip'));
  const buf = await new Response(stream).arrayBuffer();
  return new Uint8Array(buf);
}

export async function openSqliteFromBytes(
  bytes: Uint8Array,
  sha256: string
): Promise<FrameSqliteHandle> {
  const sqlite3 = await loadSqlite3();
  const p = sqlite3.wasm.allocFromTypedArray(bytes);
  const db = new sqlite3.oo1.DB();
  const rc = sqlite3.capi.sqlite3_deserialize(
    db,
    'main',
    p,
    bytes.byteLength,
    bytes.byteLength,
    sqlite3.capi.SQLITE_DESERIALIZE_READONLY
  );
  try {
    db.checkRc(rc);
  } catch (err) {
    sqlite3.wasm.dealloc(p);
    try {
      db.close();
    } catch {
      /* ignore */
    }
    throw err;
  }
  return {
    sha256,
    db,
    close: () => {
      try {
        db.close();
      } catch {
        /* already closed */
      }
      try {
        sqlite3.wasm.dealloc(p);
      } catch {
        /* already freed */
      }
    },
  };
}

export async function fetchAndOpenFrameDb(args: {
  readonly url: string;
  readonly sha256: string;
}): Promise<FrameSqliteHandle> {
  const res = await reportFetch(args.url);
  if (!res.ok) {
    throw new Error(`Failed to fetch SQLite dump (${res.status})`);
  }
  const gzipped = new Uint8Array(await res.arrayBuffer());
  const bytes = await gunzipBytes(gzipped);
  return openSqliteFromBytes(bytes, args.sha256);
}

export type SchemaObject = {
  readonly name: string;
  readonly type: 'table' | 'view' | 'index';
  readonly sql: string | null;
};

export function listSchemaObjects(db: Database): SchemaObject[] {
  const rows: SchemaObject[] = [];
  db.exec({
    sql: `SELECT type, name, sql FROM sqlite_master
          WHERE name NOT LIKE 'sqlite_%'
          ORDER BY
            CASE type WHEN 'table' THEN 0 WHEN 'view' THEN 1 ELSE 2 END,
            name COLLATE NOCASE`,
    rowMode: 'object',
    callback: (row) => {
      const r = row as Record<string, SqlValue>;
      const type = String(r['type'] ?? '');
      const name = String(r['name'] ?? '');
      if (type !== 'table' && type !== 'view' && type !== 'index') return;
      if (name.length === 0) return;
      rows.push({
        type,
        name,
        sql: r['sql'] == null ? null : String(r['sql']),
      });
    },
  });
  return rows;
}

export type SqlQueryResult = {
  readonly columns: readonly string[];
  readonly rows: readonly (readonly SqlValue[])[];
  readonly changes: number;
};

export function runSql(db: Database, sql: string): SqlQueryResult {
  const trimmed = sql.trim();
  if (trimmed.length === 0) {
    return { columns: [], rows: [], changes: 0 };
  }
  const columns: string[] = [];
  const rows: SqlValue[][] = [];
  db.exec({
    sql: trimmed,
    rowMode: 'array',
    callback: (row) => {
      const arr = row as SqlValue[];
      rows.push(arr);
    },
    columnNames: columns,
  });
  return { columns: [...columns], rows, changes: 0 };
}
