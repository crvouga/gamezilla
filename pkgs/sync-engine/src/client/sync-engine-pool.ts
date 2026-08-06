import type { SyncEngine } from './sync-engine-port';

export type SyncEnginePool = {
  readonly ready: Map<string, SyncEngine>;
  readonly pending: Map<string, Promise<SyncEngine>>;
  activeName: string | null;
};

export type CreateSyncEnginePoolOptions = {
  /** Distinct globalThis key so hosts don't collide. */
  readonly globalKey: string;
};

function getOrInitPool(globalKey: string): SyncEnginePool {
  const global = globalThis as typeof globalThis &
    Record<string, SyncEnginePool | undefined>;
  const existing = global[globalKey];
  if (existing !== undefined) return existing;
  const created: SyncEnginePool = {
    ready: new Map(),
    pending: new Map(),
    activeName: null,
  };
  global[globalKey] = created;
  return created;
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

export type SyncEnginePoolApi = {
  readonly peekReady: (databaseName: string) => SyncEngine | null;
  readonly getOrCreate: (
    databaseName: string,
    create: () => Promise<SyncEngine>
  ) => Promise<SyncEngine>;
};

/** Identity-keyed sync-engine pool stored on `globalThis`. */
export function createSyncEnginePool(
  options: CreateSyncEnginePoolOptions
): SyncEnginePoolApi {
  return {
    peekReady(databaseName) {
      return getOrInitPool(options.globalKey).ready.get(databaseName) ?? null;
    },
    async getOrCreate(databaseName, create) {
      const pool = getOrInitPool(options.globalKey);
      await deactivatePrevious(pool, databaseName);
      const ready = pool.ready.get(databaseName);
      if (ready !== undefined) {
        pool.activeName = databaseName;
        return ready;
      }
      const pending = pool.pending.get(databaseName);
      if (pending !== undefined) return pending;

      const created = create().then(
        (engine) => {
          pool.pending.delete(databaseName);
          pool.ready.set(databaseName, engine);
          pool.activeName = databaseName;
          return engine;
        },
        (error: unknown) => {
          pool.pending.delete(databaseName);
          throw error;
        }
      );
      pool.pending.set(databaseName, created);
      return created;
    },
  };
}
