import type { SyncEngine } from '@pkgs/sync-engine/client/sync-engine-port';

import {
  createAppLocalSyncEngine,
  type CreateAppLocalSyncEngineArgs,
} from './create-local-sync-engine';

type SyncEnginePool = {
  readonly ready: Map<string, SyncEngine>;
  readonly pending: Map<string, Promise<SyncEngine>>;
  activeName: string | null;
};

function getSyncEnginePool(): SyncEnginePool {
  const global = globalThis as typeof globalThis & {
    __gamezillaLocalSyncEnginePoolV1?: SyncEnginePool;
  };
  global.__gamezillaLocalSyncEnginePoolV1 ??= {
    ready: new Map(),
    pending: new Map(),
    activeName: null,
  };
  return global.__gamezillaLocalSyncEnginePoolV1;
}

async function deactivatePrevious(
  pool: SyncEnginePool,
  nextName: string
): Promise<void> {
  if (pool.activeName === null || pool.activeName === nextName) return;
  const previous = pool.ready.get(pool.activeName);
  pool.activeName = null;
  await previous?.disconnect();
}

/** Synchronous peek for a previously opened identity. */
export function peekReadyAppSyncEngine(
  databaseName: string
): SyncEngine | null {
  return getSyncEnginePool().ready.get(databaseName) ?? null;
}

/** Returns one local engine per identity-scoped SQLite database. */
export async function getOrCreateAppLocalSyncEngine(
  args: CreateAppLocalSyncEngineArgs
): Promise<SyncEngine> {
  const pool = getSyncEnginePool();
  await deactivatePrevious(pool, args.databaseName);
  const ready = pool.ready.get(args.databaseName);
  if (ready !== undefined) {
    pool.activeName = args.databaseName;
    return ready;
  }
  const pending = pool.pending.get(args.databaseName);
  if (pending !== undefined) return pending;

  const created = createAppLocalSyncEngine(args).then(
    (engine) => {
      pool.pending.delete(args.databaseName);
      pool.ready.set(args.databaseName, engine);
      pool.activeName = args.databaseName;
      return engine;
    },
    (error: unknown) => {
      pool.pending.delete(args.databaseName);
      throw error;
    }
  );
  pool.pending.set(args.databaseName, created);
  return created;
}
