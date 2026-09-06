import type { SqlClient } from '@pkgs/sql-client/interface';
import type { SqlOwner } from '../sql-owner';
import type { SqliteWorkerOpenResult, SqliteWorkerPort } from './protocol';
import {
  createSqliteWorkerRpc,
  createSqliteWorkerSqlClient,
  type SqliteWorkerRpc,
} from './sqlite-worker-client';

/** A spawned dedicated worker: message port plus hard teardown. */
export type SqliteWorkerHandle = SqliteWorkerPort & {
  terminate: () => void;
};

export type SqliteWorkerSqlOwner = SqlOwner & {
  /** Result of the most recent successful `open` (null when closed). */
  getOpenInfo: () => SqliteWorkerOpenResult | null;
};

type LiveWorker = {
  readonly handle: SqliteWorkerHandle;
  readonly rpc: SqliteWorkerRpc;
};

class SqliteWorkerSqlOwnerImpl implements SqliteWorkerSqlOwner {
  private live: LiveWorker | null = null;
  private openInfo: SqliteWorkerOpenResult | null = null;

  constructor(
    private readonly dbName: string,
    private readonly spawnWorker: (dbName: string) => SqliteWorkerHandle
  ) {}

  private spawn(): LiveWorker {
    const handle = this.spawnWorker(this.dbName);
    return { handle, rpc: createSqliteWorkerRpc(handle) };
  }

  private terminate(live: LiveWorker): void {
    live.handle.onmessage = null;
    live.handle.terminate();
    live.rpc.abortAll(new Error('SQLite worker terminated'));
  }

  async open(): Promise<SqlClient> {
    await this.close();
    const live = this.spawn();
    this.live = live;
    try {
      this.openInfo = await live.rpc.request('open', { dbName: this.dbName });
    } catch (error: unknown) {
      this.live = null;
      this.terminate(live);
      throw error;
    }
    return createSqliteWorkerSqlClient({
      rpc: live.rpc,
      onDisconnect: () => this.close(),
    });
  }

  async close(): Promise<void> {
    const live = this.live;
    if (live === null) return;
    this.live = null;
    this.openInfo = null;
    try {
      await live.rpc.request('close', {});
    } catch {
      // worker already gone; terminate below
    }
    this.terminate(live);
  }

  async resetStore(): Promise<void> {
    await this.close();
    // A fresh worker owns the VFS long enough to wipe it, then dies with it.
    const live = this.spawn();
    try {
      await live.rpc.request('resetStore', { dbName: this.dbName });
    } finally {
      this.terminate(live);
    }
  }

  getOpenInfo(): SqliteWorkerOpenResult | null {
    return this.openInfo;
  }
}

/**
 * {@link SqlOwner} backed by a dedicated worker running `@sqlite.org/sqlite-wasm`
 * over the OPFS SyncAccessHandle pool VFS. Terminating the worker releases
 * every OPFS handle, which is what makes in-process wipe possible.
 */
export function createSqliteWorkerSqlOwner(args: {
  readonly dbName: string;
  readonly spawnWorker: (dbName: string) => SqliteWorkerHandle;
}): SqliteWorkerSqlOwner {
  return new SqliteWorkerSqlOwnerImpl(args.dbName, args.spawnWorker);
}
