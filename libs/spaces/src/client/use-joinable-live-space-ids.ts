import { useMyId } from '@libs/auth/client/use-current-user';
import { useWatchQuery } from '@pkgs/sync-engine/client/sync-engine-context';
import { useMemo } from 'react';

import { sharedLiveSpaceIdsSql } from './my-live-space-seat-sql';

/** Live spaces the viewer can join: host or space_users ACL. */
export function useJoinableLiveSpaceIds(): {
  readonly spaceIds: readonly string[];
  readonly isLoading: boolean;
} {
  const memberId = useMyId();
  const enabled = memberId.length > 0;
  const query = useMemo(() => sharedLiveSpaceIdsSql({ memberId }), [memberId]);
  const { rows, isLoading } = useWatchQuery(query);
  const spaceIds = useMemo(
    () => (enabled ? rows.map((r) => r.id) : []),
    [enabled, rows]
  );
  return { spaceIds, isLoading: enabled && isLoading };
}
