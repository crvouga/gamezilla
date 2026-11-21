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
  terminated: boolean;
  readonly handle: SqliteWorkerHandle;
  readonly rpc: SqliteWorkerRpc;
};

class SqliteWorkerSqlOwnerImpl implements SqliteWorkerSqlOwner {
  private live: LiveWorker | null = null;
  private generation = 0;
  private readonly closing = new Set<LiveWorker>();
  private openInfo: SqliteWorkerOpenResult | null = null;

  constructor(
    private readonly dbName: string,
    private readonly spawnWorker: (dbName: string) => SqliteWorkerHandle,
    private readonly timers: Timers
  ) {}

  private spawn(): LiveWorker {
    const handle = this.spawnWorker(this.dbName);
    const rpc = createSqliteWorkerRpc(handle);
    const live: LiveWorker = { handle, rpc, terminated: false };
    handle.onerror = (event) => {
      rpc.abortAll(workerScriptLoadError(event));
    };
    return live;
  }

  private terminate(live: LiveWorker): void {
    if (live.terminated) return;
    live.terminated = true;
    live.handle.onmessage = null;
    live.handle.onerror = null;
    live.handle.terminate();
    live.rpc.abortAll(new Error('SQLite worker terminated'));
  }

  private assertGeneration(generation: number): void {
    if (generation !== this.generation)
      throw new Error('SQLite owner released');
  }

  async open(): Promise<SqlClient> {
    const generation = ++this.generation;
    await this.closeLive();
    this.assertGeneration(generation);
    const live = this.spawn();
    this.live = live;
    try {
      const info = await withOpenTimeout(
        this.dbName,
        live.rpc.request('open', { dbName: this.dbName }),
        this.timers
      );
      this.assertGeneration(generation);
      this.openInfo = info;
    } catch (error: unknown) {
      if (this.live === live) this.live = null;
      this.terminate(live);
      throw error;
    }
    return createSqliteWorkerSqlClient({
      rpc: live.rpc,
      onDisconnect: () =>
        this.live === live ? this.close() : Promise.resolve(),
    });
  }

  close(): Promise<void> {
    this.generation += 1;
    return this.closeLive();
  }

  private async closeLive(): Promise<void> {
    const live = this.live;
    if (live === null) return;
    this.live = null;
    this.openInfo = null;
    // Keep a synchronous teardown handle while graceful close awaits RPC.
    // A pagehide release can run before either the RPC or timer settles.
    this.closing.add(live);
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
    this.closing.delete(live);
    this.terminate(live);
  }

  release(): void {
    this.generation += 1;
    const live = this.live;
    this.live = null;
    this.openInfo = null;
    if (live !== null) this.terminate(live);
    for (const pending of this.closing) this.terminate(pending);
    this.closing.clear();
  }

  async resetStore(): Promise<void> {
    const generation = ++this.generation;
    await this.closeLive();
    this.assertGeneration(generation);
    // A fresh worker owns the VFS long enough to wipe it, then dies with it.
    const live = this.spawn();
    this.closing.add(live);
    try {
      await withOpenTimeout(
        this.dbName,
        live.rpc.request('resetStore', { dbName: this.dbName }),
        this.timers
      );
      this.assertGeneration(generation);
    } finally {
      this.closing.delete(live);
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
