import {
  SpaceMembershipCol,
  SPACE_MEMBERSHIPS_TABLE,
} from '@libs/db/shared/space-tables';
import { useWatchQuery } from '@pkgs/sync-engine/client/sync-engine-context';

type MembershipIdRow = { readonly id: string };

/**
 * Membership ids for active guests of a space, ordered by joined_at.
 */
export function useSpaceGuestMembershipIds(spaceId: string): string[] {
  const enabled = spaceId.length > 0;
  const { rows } = useWatchQuery<MembershipIdRow>(
    enabled
      ? `SELECT ${SpaceMembershipCol.id} AS id
         FROM ${SPACE_MEMBERSHIPS_TABLE.tableName}
         WHERE ${SpaceMembershipCol.spaceId} = ? AND ${SpaceMembershipCol.leftAt} IS NULL
         ORDER BY ${SpaceMembershipCol.joinedAt} ASC`
      : `SELECT ${SpaceMembershipCol.id} AS id FROM ${SPACE_MEMBERSHIPS_TABLE.tableName} WHERE 0`,
    enabled ? [spaceId] : []
  );
  return rows.map((r) => r.id);
}
