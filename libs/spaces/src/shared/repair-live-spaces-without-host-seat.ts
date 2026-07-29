import {
  SPACE_MEMBERSHIPS_TABLE,
  SpaceCol,
  SpaceMembershipCol,
  SPACES_TABLE,
} from '@libs/db/shared/space-tables';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { col, honey } from '@pkgs/sql';

/**
 * End every live space whose host has no active membership (I1 repair).
 * Returns the number of spaces stamped ended.
 */
export async function endLiveSpacesWithoutActiveHostSeat(
  db: SqlClient,
  endedAt: string = new Date().toISOString()
): Promise<number> {
  const spaces = SPACES_TABLE.tableName;
  const orphanIds = await db.query<{ readonly id: string }>(
    honey({
      select: [SpaceCol.id],
      from: [[spaces, 's']],
      where: [
        'and',
        ['is-null', `s.${SpaceCol.endedAt}`],
        [
          'not',
          [
            'exists',
            {
              select: [SpaceMembershipCol.id],
              from: [[SPACE_MEMBERSHIPS_TABLE.tableName, 'm']],
              where: [
                'and',
                [
                  '=',
                  `m.${SpaceMembershipCol.spaceId}`,
                  col(`s.${SpaceCol.id}`),
                ],
                ['is-null', `m.${SpaceMembershipCol.leftAt}`],
                [
                  'or',
                  [
                    '=',
                    `m.${SpaceMembershipCol.memberId}`,
                    col(`s.${SpaceCol.hostAccountId}`),
                  ],
                  [
                    '=',
                    `m.${SpaceMembershipCol.memberId}`,
                    col(`s.${SpaceCol.hostMemberId}`),
                  ],
                ],
              ],
            },
          ],
        ],
      ],
    })
  );
  if (orphanIds.length === 0) return 0;
  await db.run(
    honey({
      update: SPACES_TABLE.tableName,
      set: { [SpaceCol.endedAt]: endedAt },
      where: [
        'and',
        ['is-null', SpaceCol.endedAt],
        ['in', SpaceCol.id, orphanIds.map((r) => r.id)],
      ],
    })
  );
  return orphanIds.length;
}
