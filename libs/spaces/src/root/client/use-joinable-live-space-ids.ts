import { useMyId } from '@libs/auth/client/use-current-user';
import { useQuery } from '@pkgs/sync-engine/client';
import { useMemo } from 'react';

import { sharedLiveSpaceIdsSql } from './my-live-space-seat-sql';

/** Live spaces the viewer can join: host or spaces_users ACL. */
export function useJoinableLiveSpaceIds(): {
  readonly spaceIds: readonly string[];
  readonly isLoading: boolean;
} {
  const memberId = useMyId();
  const enabled = memberId.length > 0;
  const query = useMemo(() => sharedLiveSpaceIdsSql({ memberId }), [memberId]);
  const { rows, isLoading } = useQuery(query);
  const spaceIds = useMemo(
    () => (enabled ? rows.map((r) => r.id) : []),
    [enabled, rows]
  );
  return { spaceIds, isLoading: enabled && isLoading };
}
