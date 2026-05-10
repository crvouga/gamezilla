/// <reference path="./absurd-sql-modules.d.ts" />

import { assert } from '../assert';
import type { PreparedStatement, RunResult, SqlClient } from './interface';

type WorkerOp =
  | 'connect'
  | 'disconnect'
  | 'query'
  | 'run'
  | 'txBegin'
  | 'txCommit'
  | 'txRollback';

type WorkerPayload = {
  databaseName?: string;
  sql?: string;
  params?: unknown[];
};

type WorkerOutboundMessage =
  | { id: number; ok: true; result?: unknown }
  | { id: number; ok: false; error: string };

/**
 * Browser-only SQLite client: sql.js + absurd-sql IndexedDB VFS in a dedicated worker.
 * Requires cross-origin isolation (SharedArrayBuffer): serve HTML with
 * `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`
 * (see absurd-sql README). Call {@link SqlClientImplAbsurdSql.open} from web only.
 */
export class SqlClientImplAbsurdSql implements SqlClient {
  private closed = false;
  private worker: Worker | null = null;
  private nextId = 1;
  private readonly pending = new Map<
    number,
    { resolve: (v: unknown) => void; reject: (e: Error) => void }
  >();

  private constructor(private readonly databaseName: string) {}

  static async open(databaseName: string): Promise<SqlClientImplAbsurdSql> {
    const client = new SqlClientImplAbsurdSql(databaseName);
    await client.connect();
    return client;
  }

  private onWorkerMessage = (ev: MessageEvent<WorkerOutboundMessage>): void => {
    const msg = ev.data;
    const pending = this.pending.get(msg.id);
    if (pending === undefined) {
      return;
    }
    this.pending.delete(msg.id);
    if (msg.ok) {
      pending.resolve(msg.result);
    } else {
      pending.reject(new Error(msg.error));
    }
  };

  private post<T = unknown>(op: WorkerOp, payload?: WorkerPayload): Promise<T> {
    if (this.worker === null) {
      return Promise.reject(new Error('Worker not started'));
    }
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        resolve: (v) => resolve(v as T),
        reject,
      });
      this.worker!.postMessage({ id, op, payload });
    });
  }

  async connect(): Promise<void> {
    if (this.worker !== null) {
      return;
    }
    const { initBackend } =
      await import('absurd-sql/dist/indexeddb-main-thread');
    // Metro serves the app as a non-module script, so `import.meta.url` breaks. The worker is
    // pre-bundled to `public/absurd-sql-worker/` by `bun run bundle:absurd-sql-worker`.
    // Use an absolute URL string (not `new URL('./…', document.baseURI)`): on SPA routes
    // `document.baseURI` is e.g. `/profile`, which would incorrectly resolve `./…worker.ts`
    // to `/absurd-sql-db.worker.ts` at the origin root.
    const origin =
      typeof window !== 'undefined' &&
      window.location !== undefined &&
      window.location.origin !== ''
        ? window.location.origin
        : 'http://localhost';
    const workerSrc = `${origin}/absurd-sql-worker/absurd-sql-db.worker.js`;
    const worker = new Worker(workerSrc, { type: 'classic' });
    initBackend(worker);
    this.worker = worker;
    this.worker.addEventListener('message', this.onWorkerMessage);
    await this.post<void>('connect', { databaseName: this.databaseName });
  }

  async disconnect(): Promise<void> {
    this.closed = true;
    if (this.worker !== null) {
      try {
        await this.post<void>('disconnect', {});
      } catch {
        // ignore
      }
      this.worker.removeEventListener('message', this.onWorkerMessage);
      this.worker.terminate();
      this.worker = null;
    }
    this.pending.clear();
  }

  query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ): Promise<T[]> {
    if (this.closed) return Promise.resolve([] as T[]);
    return this.post<T[]>('query', { sql, params: params ?? [] });
  }

  run(sql: string, params?: unknown[]): Promise<RunResult> {
    if (this.closed) {
      return Promise.resolve({ changes: 0, lastInsertRowid: 0 });
    }
    return this.post<RunResult>('run', { sql, params: params ?? [] });
  }

  prepare(sql: string): PreparedStatement {
    return {
      query: <T = Record<string, unknown>>(params?: unknown[]) =>
        this.query<T>(sql, params),
      run: (params?: unknown[]) => this.run(sql, params),
    };
  }

  async transaction<T>(fn: (tx: SqlClient) => Promise<T>): Promise<T> {
    assert.ok(!this.closed, 'transaction on closed client');
    await this.post<void>('txBegin', {});
    try {
      const result = await fn(this);
      await this.post<void>('txCommit', {});
      return result;
    } catch (e) {
      try {
        await this.post<void>('txRollback', {});
      } catch {
        // ignore rollback errors
      }
      throw e;
    }
  }
}
