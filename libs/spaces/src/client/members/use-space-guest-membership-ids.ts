import {
  SpaceCol,
  SpaceMembershipCol,
  SPACES_TABLE,
  SPACE_MEMBERSHIPS_TABLE,
} from '@libs/db/shared/space-tables';
import { sql, ident } from '@pkgs/sql';
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
      ? sql`SELECT ${ident(SpaceMembershipCol.id)} AS id
         FROM ${ident(SPACE_MEMBERSHIPS_TABLE.tableName)}
         WHERE ${ident(SpaceMembershipCol.spaceId)} = ${spaceId}
           AND ${ident(SpaceMembershipCol.leftAt)} IS NULL
           AND ${ident(SpaceMembershipCol.memberId)} != (
             SELECT ${ident(SpaceCol.hostMemberId)} FROM ${ident(SPACES_TABLE.tableName)}
             WHERE ${ident(SpaceCol.id)} = ${spaceId}
           )
         ORDER BY ${ident(SpaceMembershipCol.joinedAt)} ASC`
      : sql`SELECT ${ident(SpaceMembershipCol.id)} AS id FROM ${ident(SPACE_MEMBERSHIPS_TABLE.tableName)} WHERE 0`
  );
  return useMemo(() => rows.map((r) => r.id), [rows]);
}
