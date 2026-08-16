import {
  createSyncEnginePool,
  type SyncEngine,
} from '@pkgs/sync-engine/client';
import {
  type CreateAppLocalSyncEngineArgs,
  createAppLocalSyncEngine,
} from './create-local-sync-engine';

/** One local engine per identity-scoped SQLite database. */
export type AppSyncEnginePool = {
  readonly peekReady: (databaseName: string) => SyncEngine | null;
  readonly getOrCreate: (
    args: CreateAppLocalSyncEngineArgs
  ) => Promise<SyncEngine>;
  /** Soft-stop all engines and close each SqlClient (releases web OPFS). */
  readonly releaseAll: () => Promise<void>;
};

/**
 * Builds an app sync-engine pool. Production passes a stable `globalKey` so the
 * pool survives HMR / re-imports; sims omit it for an isolated per-session pool
 * (owned by the simulation, never a process singleton).
 */
export function createAppSyncEnginePool(options?: {
  readonly globalKey?: string;
}): AppSyncEnginePool {
  const pool = createSyncEnginePool(
    options?.globalKey === undefined ? {} : { globalKey: options.globalKey }
  );
  return {
    peekReady: (databaseName) => pool.peekReady(databaseName),
    getOrCreate: (args) =>
      pool.getOrCreate(args.databaseName, () => createAppLocalSyncEngine(args)),
    releaseAll: () => pool.releaseAll(),
  };
}

/** Process-wide pool for the shipping app. */
export const defaultAppSyncEnginePool = createAppSyncEnginePool({
  globalKey: '__gamezillaLocalSyncEnginePoolV1',
});

/** Synchronous peek for a previously opened identity. */
export function peekReadyAppSyncEngine(
  databaseName: string
): SyncEngine | null {
  return defaultAppSyncEnginePool.peekReady(databaseName);
}

/** Returns one local engine per identity-scoped SQLite database. */
export async function getOrCreateAppLocalSyncEngine(
  args: CreateAppLocalSyncEngineArgs
): Promise<SyncEngine> {
  return defaultAppSyncEnginePool.getOrCreate(args);
}
