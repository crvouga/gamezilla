import { useSyncEngine } from '@pkgs/sync-engine-client-ts/sync-engine-context';
import type { Accessor } from 'solid-js';

/** This device has never finished a sync, and the last attempt failed. */
export function useFirstSyncFailed(): Accessor<boolean> {
  const { status } = useSyncEngine();
  return () => !status().hasEverSynced && status().lastError !== null;
}
