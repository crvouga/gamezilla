import type { SyncEngineStatus, SyncStatusSubscription } from './sync-status';
import { INITIAL_SYNC_STATUS } from './sync-status';

export type LocalSyncStatusStore = {
  readonly status: SyncStatusSubscription;
  readonly patch: (patch: Partial<SyncEngineStatus>) => void;
  readonly reset: () => void;
};

export function createLocalSyncStatusStore(): LocalSyncStatusStore {
  let snapshot: SyncEngineStatus = { ...INITIAL_SYNC_STATUS };
  const listeners = new Set<(status: SyncEngineStatus) => void>();

  const publish = (next: SyncEngineStatus): void => {
    const current: Readonly<Record<string, unknown>> = snapshot;
    if (
      Object.entries(next).every(([key, value]) =>
        Object.is(current[key], value)
      )
    )
      return;
    snapshot = next;
    for (const listener of [...listeners]) {
      if (listeners.has(listener)) listener(snapshot);
    }
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
