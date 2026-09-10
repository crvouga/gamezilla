import type { SyncEngine } from './sync-engine-port';

export type SyncEnginePool = {
  readonly ready: Map<string, SyncEngine>;
  readonly pending: Map<string, Promise<SyncEngine>>;
  activeName: string | null;
  /**
   * Serializes getOrCreate so identity switches never overlap local SQLite
   * opens (web OPFS is single-session).
   */
  opChain: Promise<void>;
};

export type CreateSyncEnginePoolOptions = {
  /**
   * Distinct globalThis key so hosts don't collide and the pool survives HMR /
   * re-imports. Omit for an isolated in-process pool (sims/tests) that is never
   * stored on `globalThis`.
   */
  readonly globalKey?: string;
};

function createPool(): SyncEnginePool {
  return {
    ready: new Map(),
    pending: new Map(),
    activeName: null,
    opChain: Promise.resolve(),
  };
}

function getOrInitPool(globalKey: string): SyncEnginePool {
  const global = globalThis as typeof globalThis &
    Record<string, SyncEnginePool | undefined>;
  const existing = global[globalKey];
  if (existing !== undefined) {
    if (existing.opChain === undefined) {
      existing.opChain = Promise.resolve();
    }
    return existing;
  }
  const created = createPool();
  global[globalKey] = created;
  return created;
}

async function deactivatePrevious(
  pool: SyncEnginePool,
  nextName: string
): Promise<void> {
  if (pool.activeName === null || pool.activeName === nextName) return;
  const previousName = pool.activeName;
  const previous = pool.ready.get(previousName);
  pool.activeName = null;
  if (previous === undefined) return;
  // Soft-stop sync first, then close SQLite. Web OPFS is single-session: leaving
  // the prior identity's handle open makes the next open fail (and OPFS wipe
  // recovery throws "another tab or worker is holding the OPFS handle").
  await previous.disconnect();
  await previous.db.disconnect();
  pool.ready.delete(previousName);
}

export type SyncEnginePoolApi = {
  readonly peekReady: (databaseName: string) => SyncEngine | null;
  readonly getOrCreate: (
    databaseName: string,
    create: () => Promise<SyncEngine>
  ) => Promise<SyncEngine>;
  /**
   * Soft-stop every ready engine (upload loops / push), close each engine's
   * SqlClient (releases web OPFS Access Handles), and clear the pool.
   */
  readonly releaseAll: () => Promise<void>;
};

/**
 * Identity-keyed sync-engine pool. Stored on `globalThis` when `globalKey` is
 * set; otherwise isolated to this closure (sims/tests own their own pool).
 */
export function createSyncEnginePool(
  options: CreateSyncEnginePoolOptions = {}
): SyncEnginePoolApi {
  let ownPool: SyncEnginePool | null = null;
  let releaseGeneration = 0;
  const resolvePool = (): SyncEnginePool => {
    if (options.globalKey !== undefined) {
      return getOrInitPool(options.globalKey);
    }
    ownPool ??= createPool();
    return ownPool;
  };
  return {
    peekReady(databaseName) {
      return resolvePool().ready.get(databaseName) ?? null;
    },
    async getOrCreate(databaseName, create) {
      const pool = resolvePool();
      const generationAtStart = releaseGeneration;

      const run = async (): Promise<SyncEngine> => {
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
            // releaseAll cleared this generation — do not resurrect a closed DB.
            if (generationAtStart !== releaseGeneration) {
              // Best-effort teardown of aborted open — ignore disconnect rejections.
              void engine.disconnect().catch(() => undefined);
              void engine.db.disconnect().catch(() => undefined);
              throw new Error(
                'sync-engine-pool: getOrCreate aborted after releaseAll'
              );
            }
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
      };

      const result = pool.opChain.then(run, run);
      pool.opChain = result.then(
        () => undefined,
        () => undefined
      );
      return result;
    },
    async releaseAll() {
      releaseGeneration += 1;
      const pool = resolvePool();
      const engines = [...pool.ready.values()];
      pool.ready.clear();
      pool.pending.clear();
      pool.activeName = null;
      for (const engine of engines) {
        // Soft-stop sync first, then close SQLite — same order as
        // deactivatePrevious. Web OPFS is single-session; leaving handles
        // open blocks the next open (Console product-simulator, tab remount).
        await engine.disconnect();
        await engine.db.disconnect();
      }
    },
  };
}
