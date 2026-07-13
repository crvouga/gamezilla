import {
  useMyAccountId,
  useMyDeviceId,
} from '@libs/auth/client/use-current-user';
import {
  SpaceCol,
  SpaceMembershipCol,
  SPACES_TABLE,
  SPACE_MEMBERSHIPS_TABLE,
} from '@libs/db/shared/space-tables';
import { useWatchQuery } from '@pkgs/sync-engine/client/sync-engine-context';

import type { LiveSpaceSection } from './live-space-section';

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
 * Deduped by SQL (single SELECT).
 */
function useFriendsLiveSpaceIds(): {
  readonly spaceIds: readonly string[];
  readonly isLoading: boolean;
} {
  const deviceId = useMyDeviceId();
  const accountId = useMyAccountId();
  const hasAccount = accountId !== null && accountId.length > 0;
  const { rows, isLoading } = useWatchQuery<SpaceIdRow>(
    hasAccount
      ? `SELECT ${SpaceCol.id} AS id FROM ${SPACES_TABLE.tableName}
         WHERE ${SpaceCol.endedAt} IS NULL
           AND (
             ${SpaceCol.visibility} = 'friends'
             OR ${SpaceCol.hostId} = ?
             OR ${SpaceCol.hostAccountId} = ?
             OR ${SpaceCol.id} IN (
               SELECT ${SpaceMembershipCol.spaceId}
               FROM ${SPACE_MEMBERSHIPS_TABLE.tableName}
               WHERE ${SpaceMembershipCol.leftAt} IS NULL
                 AND (
                   ${SpaceMembershipCol.guestId} = ?
                   OR ${SpaceMembershipCol.profileId} = ?
                 )
             )
           )
         ORDER BY ${SpaceCol.createdAt} DESC`
      : `SELECT ${SpaceCol.id} AS id FROM ${SPACES_TABLE.tableName}
         WHERE ${SpaceCol.endedAt} IS NULL
           AND (
             ${SpaceCol.visibility} = 'friends'
             OR ${SpaceCol.hostId} = ?
             OR ${SpaceCol.id} IN (
               SELECT ${SpaceMembershipCol.spaceId}
               FROM ${SPACE_MEMBERSHIPS_TABLE.tableName}
               WHERE ${SpaceMembershipCol.leftAt} IS NULL
                 AND ${SpaceMembershipCol.guestId} = ?
             )
           )
         ORDER BY ${SpaceCol.createdAt} DESC`,
    hasAccount && accountId !== null
      ? [deviceId, accountId, deviceId, accountId]
      : [deviceId, deviceId]
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
