import { useSyncEngineSubscriptions } from '@pkgs/sync-engine/client/use-sync-engine-subscriptions';
import { useMemo } from 'react';

/**
 * Explicitly subscribe to `space_visible_profiles` (host + live-member
 * profiles for browse/active spaces). Auto-subscribe alone can leave existing
 * clients without the stream until a full reconnect cycle.
 */
export function useSpaceVisibleProfilesSubscription(): void {
  const specs = useMemo(
    () =>
      [
        {
          stream: 'space_visible_profiles',
          params: {},
          priority: 2,
        },
      ] as const,
    []
  );
  useSyncEngineSubscriptions(specs);
}
