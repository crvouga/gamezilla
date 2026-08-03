import {
  useMyAccountId,
  useMyDeviceId,
} from '@libs/auth/client/use-current-user';
import { useWatchQuery } from '@pkgs/sync-engine/client/sync-engine-context';
import { useMemo } from 'react';

import { sharedLiveSpaceIdsSql } from './my-live-space-seat-sql';

/** Live spaces the viewer can join: host or space_users ACL. */
export function useJoinableLiveSpaceIds(): {
  readonly spaceIds: readonly string[];
  readonly isLoading: boolean;
} {
  const deviceId = useMyDeviceId();
  const accountId = useMyAccountId();
  const hasAccount = accountId !== null && accountId.length > 0;
  const memberId = hasAccount && accountId !== null ? accountId : deviceId;
  const query = useMemo(() => sharedLiveSpaceIdsSql({ memberId }), [memberId]);
  const { rows, isLoading } = useWatchQuery(query);
  const spaceIds = useMemo(() => rows.map((r) => r.id), [rows]);
  return { spaceIds, isLoading };
}
