import {
  SpaceCol,
  SpaceMembershipCol,
  SPACES_TABLE,
  SPACE_MEMBERSHIPS_TABLE,
} from '@libs/db/shared/space-tables';
import { honey } from '@pkgs/sql';
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
      ? honey({
          select: [SpaceMembershipCol.id],
          from: SPACE_MEMBERSHIPS_TABLE.tableName,
          where: [
            'and',
            ['=', SpaceMembershipCol.spaceId, spaceId],
            ['is-null', SpaceMembershipCol.leftAt],
            [
              '!=',
              SpaceMembershipCol.memberId,
              {
                select: [SpaceCol.hostMemberId],
                from: SPACES_TABLE.tableName,
                where: ['=', SpaceCol.id, spaceId],
              },
            ],
          ],
          orderBy: [[SpaceMembershipCol.joinedAt, 'asc']],
        })
      : honey({
          select: [SpaceMembershipCol.id],
          from: SPACE_MEMBERSHIPS_TABLE.tableName,
          where: ['=', 1, 0],
        })
  );
  return useMemo(() => rows.map((r) => r.id), [rows]);
}
