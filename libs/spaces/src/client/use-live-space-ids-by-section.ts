import {
  useMyAccountId,
  useMyDeviceId,
} from '@libs/auth/client/use-current-user';
import { SpaceCol, SPACES_TABLE } from '@libs/db/shared/space-tables';
import { useWatchQuery } from '@pkgs/sync-engine/client/sync-engine-context';
import { useMemo } from 'react';

import type { LiveSpaceSection } from './live-space-section';
import { friendsLiveSpaceIdsSql } from './my-live-space-seat-sql';

type SpaceIdRow = { readonly id: string };

export type { LiveSpaceSection };

function usePublicLiveSpaceIds(): {
  readonly spaceIds: readonly string[];
  readonly isLoading: boolean;
} {
  const { rows, isLoading } = useWatchQuery<SpaceIdRow>(
    `SELECT ${SpaceCol.id} AS id FROM ${SPACES_TABLE.tableName}
     WHERE ${SpaceCol.endedAt} IS NULL
       AND ${SpaceCol.visibility} = 'public'
     ORDER BY ${SpaceCol.createdAt} DESC`
  );
  return { spaceIds: rows.map((r) => r.id), isLoading };
}

/**
 * Friends-visible live spaces plus spaces on this account/device, newest-first.
 * Deduped by SQL (single SELECT). Host seats require no left_at — same rule as
 * the miniplayer — so cross-client leave/end cannot leave orphan Live cards.
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
  const { rows, isLoading } = useWatchQuery<SpaceIdRow>(
    query.sql,
    [...query.params]
  );
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
