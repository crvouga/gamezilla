import { useClock } from '@pkgs/clock-client-ts/solid';
import { useSyncEngine } from '@pkgs/sync-engine-client-ts/sync-engine-context';
import { type Accessor, createMemo } from 'solid-js';

/**
 * When this device lost its connection, or null while connected. An offline
 * device keeps showing its last known clocks and search time from then.
 */
export function useOfflineSince(): Accessor<number | null> {
  const sync = useSyncEngine();
  const clock = useClock();
  return createMemo<number | null>(
    (since) => (sync.status().online ? null : (since ?? clock.now())),
    null
  );
}
