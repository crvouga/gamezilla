import {
  SPACE_USERS_TABLE,
  SpaceCol,
  SPACES_TABLE,
  SpaceUserCol,
} from '@libs/db/shared/space-tables';
import type { Sql } from '@pkgs/sql';
import { sqlMap } from '@pkgs/sql-map';

/**
 * Shared lobby live ids: host of the space OR has a space_users ACL row.
 */
export function sharedLiveSpaceIdsSql(args: {
  readonly memberId: string;
}): Sql {
  const spaces = SPACES_TABLE.tableName;
  return sqlMap({
    select: [SpaceCol.id],
    from: spaces,
    where: [
      'and',
      ['is-null', SpaceCol.endedAt],
      [
        'or',
        ['=', SpaceCol.hostMemberId, args.memberId],
        ['=', SpaceCol.hostAccountId, args.memberId],
        [
          'in',
          SpaceCol.id,
          {
            select: [SpaceUserCol.spaceId],
            from: SPACE_USERS_TABLE.tableName,
            where: ['=', SpaceUserCol.userId, args.memberId],
          },
        ],
      ],
    ],
    orderBy: [[SpaceCol.createdAt, 'desc']],
  });
}
