import {
  SpaceCol,
  SpaceMembershipCol,
  SPACES_TABLE,
  SPACE_MEMBERSHIPS_TABLE,
} from '@libs/db/shared/space-tables';
import { useWatchQuery } from '@pkgs/sync-engine/client/sync-engine-context';
import { useMemo } from 'react';

type MembershipIdRow = { readonly id: string };

/**
 * Membership ids for active guests of a space (excludes the host member),
 * ordered by joined_at.
 */
export function useSpaceGuestMembershipIds(spaceId: string): string[] {
  const enabled = spaceId.length > 0;
  const { rows } = useWatchQuery<MembershipIdRow>(
    enabled
      ? `SELECT ${SpaceMembershipCol.id} AS id
         FROM ${SPACE_MEMBERSHIPS_TABLE.tableName}
         WHERE ${SpaceMembershipCol.spaceId} = ?
           AND ${SpaceMembershipCol.leftAt} IS NULL
           AND ${SpaceMembershipCol.memberId} != (
             SELECT ${SpaceCol.hostMemberId} FROM ${SPACES_TABLE.tableName}
             WHERE ${SpaceCol.id} = ?
           )
         ORDER BY ${SpaceMembershipCol.joinedAt} ASC`
      : `SELECT ${SpaceMembershipCol.id} AS id FROM ${SPACE_MEMBERSHIPS_TABLE.tableName} WHERE 0`,
    enabled ? [spaceId, spaceId] : []
  );
  return useMemo(() => rows.map((r) => r.id), [rows]);
}
