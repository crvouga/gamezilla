import type { SyncEngine } from '@pkgs/sync-engine/client/sync-engine-port';
import type { SyncEngineBootState } from '@pkgs/sync-engine/client/use-sync-engine-boot-state';
import { useSyncEngineBootState as usePackageSyncEngineBootState } from '@pkgs/sync-engine/client/use-sync-engine-boot-state';

import { attachSqlCli } from '../../dev/attach-sql-cli';

export type { SyncEngineBootState };

/**
 * Opens the identity-scoped sync engine for local reads as soon as the DB is
 * ready. Attaches the product SQL CLI on cold boot ready.
 */
export function useSyncEngineBootState(
  enginePromise: Promise<SyncEngine>,
  warmEngine: SyncEngine | null
): SyncEngineBootState {
  return usePackageSyncEngineBootState(enginePromise, warmEngine, {
    onReady: (db) => {
      attachSqlCli(db);
    },
  });
}
