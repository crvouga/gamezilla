import {
  useMyAccountId,
  useMyDeviceId,
} from '@libs/auth/client/use-current-user';
import { useWatchQuery } from '@pkgs/sync-engine/client/sync-engine-context';
import { useMemo } from 'react';

import type { LiveSpaceSection } from './live-space-section';
import {
  friendsLiveSpaceIdsSql,
  publicLiveSpaceIdsSql,
} from './my-live-space-seat-sql';

type SpaceIdRow = { readonly id: string };

export type { LiveSpaceSection };

function usePublicLiveSpaceIds(): {
  readonly spaceIds: readonly string[];
  readonly isLoading: boolean;
} {
  const { rows, isLoading } = useWatchQuery<SpaceIdRow>(
    publicLiveSpaceIdsSql()
  );
  return { spaceIds: rows.map((r) => r.id), isLoading };
}

/**
 * Friends-visible live spaces plus this account's active seats (I6).
 */
function useFriendsLiveSpaceIds(): {
  readonly spaceIds: readonly string[];
  readonly isLoading: boolean;
} {
  const deviceId = useMyDeviceId();
  const accountId = useMyAccountId();
  const hasAccount = accountId !== null && accountId.length > 0;
  const query = useMemo(
    () =>
      friendsLiveSpaceIdsSql({
        memberId: hasAccount && accountId !== null ? accountId : deviceId,
        includeHostAccountId: hasAccount,
      }),
    [accountId, deviceId, hasAccount]
  );
  const { rows, isLoading } = useWatchQuery<SpaceIdRow>(query);
  return { spaceIds: rows.map((r) => r.id), isLoading };
}

/**
 * Live spaces for one lobby section, newest-first.
 */
export function useLiveSpaceIdsBySection(section: LiveSpaceSection): {
  readonly spaceIds: readonly string[];
  readonly isLoading: boolean;
} {
  const publicIds = usePublicLiveSpaceIds();
  const friendsIds = useFriendsLiveSpaceIds();
  if (section === 'public') return publicIds;
  return friendsIds;
}
