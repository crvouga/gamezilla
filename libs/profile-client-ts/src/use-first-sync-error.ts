import { useSyncEngine } from '@pkgs/sync-engine-client-ts/sync-engine-context';
import type { Accessor } from 'solid-js';

/**
 * True while this device has never finished a sync and the last attempt
 * failed: whatever a screen shows from local data may simply not have
 * arrived yet, so it explains the failure instead of claiming emptiness.
 */
export function useFirstSyncError(): Accessor<boolean> {
  const engine = useSyncEngine();
  return () => {
    const status = engine.status();
    return !status.hasEverSynced && status.lastError !== null;
  };
}
