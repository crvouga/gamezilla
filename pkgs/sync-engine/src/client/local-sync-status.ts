import {
  INITIAL_SYNC_STATUS,
  type SyncEngineStatus,
  type SyncStatusSubscription,
} from './sync-status';

export type LocalSyncStatusStore = {
  readonly status: SyncStatusSubscription;
  readonly patch: (patch: Partial<SyncEngineStatus>) => void;
  readonly reset: () => void;
};

export function createLocalSyncStatusStore(): LocalSyncStatusStore {
  let snapshot: SyncEngineStatus = { ...INITIAL_SYNC_STATUS };
  const listeners = new Set<(status: SyncEngineStatus) => void>();

  const publish = (next: SyncEngineStatus): void => {
    snapshot = next;
    for (const listener of listeners) listener(snapshot);
  };

  return {
    status: {
      getSnapshot: () => snapshot,
      subscribe: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    },
    patch: (patch) => {
      const hasEverSynced =
        snapshot.hasEverSynced || patch.hasSynced === true
          ? true
          : (patch.hasEverSynced ?? snapshot.hasEverSynced);
      publish({ ...snapshot, ...patch, hasEverSynced });
    },
    reset: () => publish({ ...INITIAL_SYNC_STATUS }),
  };
}
