import {
  createSyncEnginePool,
  type SyncEngine,
} from '@pkgs/sync-engine/client';
import {
  type CreateAppLocalSyncEngineArgs,
  createAppLocalSyncEngine,
} from './create-local-sync-engine';

const pool = createSyncEnginePool({
  globalKey: '__gamezillaLocalSyncEnginePoolV1',
});

/** Synchronous peek for a previously opened identity. */
export function peekReadyAppSyncEngine(
  databaseName: string
): SyncEngine | null {
  return pool.peekReady(databaseName);
}

/** Returns one local engine per identity-scoped SQLite database. */
export async function getOrCreateAppLocalSyncEngine(
  args: CreateAppLocalSyncEngineArgs
): Promise<SyncEngine> {
  return pool.getOrCreate(args.databaseName, () =>
    createAppLocalSyncEngine(args)
  );
}
