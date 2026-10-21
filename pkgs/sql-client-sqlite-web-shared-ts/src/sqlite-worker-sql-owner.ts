import type { Timers } from '@pkgs/clock-shared-ts/types';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import { withOpenTimeout } from './open-retry';
import type { SqliteWorkerOpenResult, SqliteWorkerPort } from './protocol';
import type { SqlOwner } from './sql-owner';
import type { SqliteWorkerRpc } from './sqlite-worker-client';
import {
  createSqliteWorkerRpc,
  createSqliteWorkerSqlClient,
} from './sqlite-worker-client';
import { workerScriptLoadError } from './worker-script-load-error';

/** A spawned dedicated worker: message port plus hard teardown. */
export type SqliteWorkerHandle = SqliteWorkerPort & {
  terminate: () => void;
  /** Browser `Worker.onerror` — script parse/load failures (HTML-as-JS). */
  onerror?: ((event: ErrorEvent) => void) | null;
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
    private readonly spawnWorker: (dbName: string) => SqliteWorkerHandle,
    private readonly timers: Timers
  ) {}

  private spawn(): LiveWorker {
    const handle = this.spawnWorker(this.dbName);
    const rpc = createSqliteWorkerRpc(handle);
    const live: LiveWorker = { handle, rpc };
    handle.onerror = (event) => {
      rpc.abortAll(workerScriptLoadError(event));
    };
    return live;
  }

  private terminate(live: LiveWorker): void {
    live.handle.onmessage = null;
    live.handle.onerror = null;
    live.handle.terminate();
    live.rpc.abortAll(new Error('SQLite worker terminated'));
  }

  async open(): Promise<SqlClient> {
    await this.close();
    const live = this.spawn();
    this.live = live;
    try {
      this.openInfo = await withOpenTimeout(
        this.dbName,
        live.rpc.request('open', { dbName: this.dbName }),
        this.timers
      );
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
    let timeout: unknown;
    try {
      await Promise.race([
        live.rpc.request('close', {}),
        new Promise<void>((resolve) => {
          timeout = this.timers.setTimeout(resolve, 1000);
        }),
      ]);
    } catch {
      // worker already gone; terminate below
    }
    this.timers.clearTimeout(timeout);
    this.terminate(live);
  }

  release(): void {
    const live = this.live;
    if (live === null) return;
    this.live = null;
    this.openInfo = null;
    this.terminate(live);
  }

  async resetStore(): Promise<void> {
    await this.close();
    // A fresh worker owns the VFS long enough to wipe it, then dies with it.
    const live = this.spawn();
    try {
      await withOpenTimeout(
        this.dbName,
        live.rpc.request('resetStore', { dbName: this.dbName }),
        this.timers
      );
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
  readonly timers: Timers;
  readonly spawnWorker: (dbName: string) => SqliteWorkerHandle;
}): SqliteWorkerSqlOwner {
  return new SqliteWorkerSqlOwnerImpl(
    args.dbName,
    args.spawnWorker,
    args.timers
  );
}
