import {
  SPACE_MEMBERSHIPS_TABLE,
  SpaceCol,
  SpaceMembershipCol,
  SPACES_TABLE,
} from '@libs/db/shared/space-tables';
import { col, honey, type Expr, type Query, type Sql } from '@pkgs/sql';

/**
 * Live spaces this account has an active seat in (I2) — honey Query map for nesting.
 */
export function myActiveSeatSpaceIdsQuery(args: {
  readonly memberId: string;
  readonly includeProfileId: boolean;
}): Query {
  const membershipFilter: Expr = args.includeProfileId
    ? [
        'or',
        ['=', SpaceMembershipCol.memberId, args.memberId],
        ['=', SpaceMembershipCol.profileId, args.memberId],
      ]
    : ['=', SpaceMembershipCol.memberId, args.memberId];
  return {
    select: [SpaceMembershipCol.spaceId],
    from: SPACE_MEMBERSHIPS_TABLE.tableName,
    where: ['and', ['is-null', SpaceMembershipCol.leftAt], membershipFilter],
  };
}

/**
 * Miniplayer seats: active memberships joined to live spaces (I7).
 */
export function myLiveSeatSpacesSelectSql(memberId: string): Sql {
  const spaces = SPACES_TABLE.tableName;
  const memberships = SPACE_MEMBERSHIPS_TABLE.tableName;
  return honey({
    select: [
      [`s.${SpaceCol.id}`, SpaceCol.id],
      [`s.${SpaceCol.hostMemberId}`, SpaceCol.hostMemberId],
      [`s.${SpaceCol.hostAccountId}`, SpaceCol.hostAccountId],
      [`s.${SpaceCol.endedAt}`, SpaceCol.endedAt],
      [`m.${SpaceMembershipCol.joinedAt}`, SpaceMembershipCol.joinedAt],
    ],
    from: [[memberships, 'm']],
    join: [
      [spaces, 's'],
      ['=', `s.${SpaceCol.id}`, col(`m.${SpaceMembershipCol.spaceId}`)],
    ],
    where: [
      'and',
      ['=', `m.${SpaceMembershipCol.memberId}`, memberId],
      ['is-null', `m.${SpaceMembershipCol.leftAt}`],
      ['is-null', `s.${SpaceCol.endedAt}`],
    ],
    orderBy: [[`m.${SpaceMembershipCol.joinedAt}`, 'desc']],
  });
}

/**
 * Friends lobby live ids: friends-visible lobbies plus my active seats (I6).
 */
export function friendsLiveSpaceIdsSql(args: {
  readonly memberId: string;
  readonly includeHostAccountId: boolean;
}): Sql {
  const spaces = SPACES_TABLE.tableName;
  return honey({
    select: [SpaceCol.id],
    from: spaces,
    where: [
      'and',
      ['is-null', SpaceCol.endedAt],
      [
        'or',
        ['=', SpaceCol.visibility, 'friends'],
        [
          'in',
          SpaceCol.id,
          myActiveSeatSpaceIdsQuery({
            memberId: args.memberId,
            includeProfileId: args.includeHostAccountId,
          }),
        ],
      ],
    ],
    orderBy: [[SpaceCol.createdAt, 'desc']],
  });
}

/**
 * Public lobby live ids: public visibility only (I5).
 */
export function publicLiveSpaceIdsSql(): Sql {
  return honey({
    select: [SpaceCol.id],
    from: SPACES_TABLE.tableName,
    where: [
      'and',
      ['is-null', SpaceCol.endedAt],
      ['=', SpaceCol.visibility, 'public'],
    ],
    orderBy: [[SpaceCol.createdAt, 'desc']],
  });
}
