import { useSyncEngine } from '@pkgs/sync-engine-client-ts/sync-engine-context';
import type { Accessor } from 'solid-js';

/**
 * Local data is readable after hydration, including an offline restart.
 * The lobby's individual queries own their loading states.
 */
export function useSpacesListReady(): Accessor<boolean> {
  return useSyncEngine().paintReady;
}
