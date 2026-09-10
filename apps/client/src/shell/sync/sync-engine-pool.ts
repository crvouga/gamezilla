/**
 * One local engine per identity-scoped SQLite database. The pool, the engine
 * factory and the product registries are all loaded on demand so
 * `@pkgs/sync-engine/client` (and its SQL AST parser), the app schema and the
 * SQLite broker stay out of the initial JS chunk.
 */

import type { SyncEngine } from '@pkgs/sync-engine/client';
import type { MutationRegistry } from '@pkgs/sync-engine/shared';
import type {
  CreateAppLocalSyncEngineArgs,
  CreateAppLocalSyncEnginePoolArgs,
} from './create-local-sync-engine';

export type { CreateAppLocalSyncEngineArgs, CreateAppLocalSyncEnginePoolArgs };

export type AppSyncEnginePool = {
  readonly getOrCreate: (
    args: CreateAppLocalSyncEnginePoolArgs
  ) => Promise<SyncEngine>;
  /** Product mutation registry (loaded with the first engine). */
  readonly mutationRegistry: () => Promise<MutationRegistry>;
  /**
   * Ready engine for `databaseName`, or `null` (never requested / still
   * booting). Sync read for sim snapshot drains; never creates an engine.
   */
  readonly peekReady: (databaseName: string) => SyncEngine | null;
  /** Soft-stop all engines and close each SqlClient (releases web OPFS). */
  readonly releaseAll: () => Promise<void>;
};

type EngineModule = typeof import('./create-local-sync-engine');
type MutationsModule = typeof import('@apps/client/sync/app-mutations');
type PoolApi = ReturnType<
  typeof import('@pkgs/sync-engine/client')['createSyncEnginePool']
>;

function once<T>(load: () => Promise<T>): () => Promise<T> {
  let pending: Promise<T> | null = null;
  return () => {
    pending ??= load();
    return pending;
  };
}

/**
 * Builds an app sync-engine pool. Production passes a stable `globalKey` so the
 * pool survives HMR / re-imports; sims omit it for an isolated per-session pool
 * (owned by the simulation, never a process singleton).
 */
export function createAppSyncEnginePool(options?: {
  readonly globalKey?: string | undefined;
}): AppSyncEnginePool {
  let poolPromise: Promise<PoolApi> | null = null;
  let loadedPool: PoolApi | null = null;
  const loadPool = (): Promise<PoolApi> => {
    poolPromise ??= import('@pkgs/sync-engine/client').then((mod) => {
      loadedPool = mod.createSyncEnginePool(
        options?.globalKey === undefined ? {} : { globalKey: options.globalKey }
      );
      return loadedPool;
    });
    return poolPromise;
  };
  const loadEngineModule = once(
    (): Promise<EngineModule> => import('./create-local-sync-engine')
  );
  const loadMutations = once(
    (): Promise<MutationsModule> => import('@apps/client/sync/app-mutations')
  );
  return {
    getOrCreate: async (args) => {
      const pool = await loadPool();
      return pool.getOrCreate(args.databaseName, async () => {
        const [mod, mutations] = await Promise.all([
          loadEngineModule(),
          loadMutations(),
        ]);
        return mod.createAppLocalSyncEngine({
          ...args,
          mutationRegistry: mutations.APP_MUTATIONS,
        });
      });
    },
    mutationRegistry: async () => (await loadMutations()).APP_MUTATIONS,
    peekReady: (databaseName) => loadedPool?.peekReady(databaseName) ?? null,
    releaseAll: async () => {
      // Nothing to release when no engine was ever requested.
      if (poolPromise === null) return;
      const pool = await poolPromise;
      await pool.releaseAll();
    },
  };
}
