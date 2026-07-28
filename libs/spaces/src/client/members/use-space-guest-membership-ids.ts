import {
  SpaceCol,
  SpaceMembershipCol,
  SPACES_TABLE,
  SPACE_MEMBERSHIPS_TABLE,
} from '@libs/db/shared/space-tables';
import { raw, sql } from '@pkgs/sql';
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
      ? sql`SELECT ${raw(SpaceMembershipCol.id)} AS id
         FROM ${raw(SPACE_MEMBERSHIPS_TABLE.tableName)}
         WHERE ${raw(SpaceMembershipCol.spaceId)} = ${spaceId}
           AND ${raw(SpaceMembershipCol.leftAt)} IS NULL
           AND ${raw(SpaceMembershipCol.memberId)} != (
             SELECT ${raw(SpaceCol.hostMemberId)} FROM ${raw(SPACES_TABLE.tableName)}
             WHERE ${raw(SpaceCol.id)} = ${spaceId}
           )
         ORDER BY ${raw(SpaceMembershipCol.joinedAt)} ASC`
      : sql`SELECT ${raw(SpaceMembershipCol.id)} AS id FROM ${raw(SPACE_MEMBERSHIPS_TABLE.tableName)} WHERE 0`
  );
  return useMemo(() => rows.map((r) => r.id), [rows]);
}
