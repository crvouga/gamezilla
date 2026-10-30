import { createSyncEnginePool } from '@pkgs/sync-engine-client-ts/sync-engine-pool';
import { traceBrowserStartup } from './browser-boundaries';
import { createAppLocalSyncEngine } from './create-local-sync-engine';
/** One local engine per identity-scoped database; code is imported eagerly. */

import type { SyncEngine } from '@pkgs/sync-engine-client-ts/sync-engine-port';
import type { MutationRegistry } from '@pkgs/sync-engine-shared-ts/mutations-types';
import type { CreateAppLocalSyncEnginePoolArgs } from './create-local-sync-engine';

export type AppSyncEnginePool = {
  readonly getOrCreate: (
    args: CreateAppLocalSyncEnginePoolArgs
  ) => Promise<SyncEngine>;
  /** Product mutation registry (loaded with the first engine). */
  readonly mutationRegistry: () => Promise<MutationRegistry>;
  /**
   * Ready engine for `databaseName`, or `null` (never requested / still
   * booting). Sync read for harness snapshot drains; never creates an engine.
   */
  readonly peekReady: (databaseName: string) => SyncEngine | null;
  /** Soft-stop all engines and close each SqlClient (releases web OPFS). */
  readonly releaseAll: () => Promise<void>;
};

function once<T>(load: () => Promise<T>): () => Promise<T> {
  let pending: Promise<T> | null = null;
  return () => {
    pending ??= load();
    return pending;
  };
}

/**
 * Builds an app sync-engine pool. Production passes a stable `globalKey` so the
 * pool survives HMR / re-imports; harnesses omit it for an isolated per-session pool
 * (owned by the simulation, never a process singleton).
 */
export function createAppSyncEnginePool(options: {
  readonly globalKey?: string | undefined;
  /** The composed subs' writes, loaded with the first engine. */
  readonly loadMutations: () => Promise<MutationRegistry>;
}): AppSyncEnginePool {
  const pool = createSyncEnginePool(
    options.globalKey === undefined ? {} : { globalKey: options.globalKey }
  );
  const loadMutations = once(() =>
    traceBrowserStartup('client.boot.registry', options.loadMutations)
  );
  return {
    getOrCreate: async (args) => {
      return traceBrowserStartup('client.boot.pool', () =>
        pool.getOrCreate(args.databaseName, async () => {
          const mutations = await loadMutations();
          return createAppLocalSyncEngine({
            ...args,
            mutationRegistry: mutations,
          });
        })
      );
    },
    mutationRegistry: () => loadMutations(),
    peekReady: (databaseName) => pool.peekReady(databaseName),
    releaseAll: () => pool.releaseAll(),
  };
}
