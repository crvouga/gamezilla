import {
  SPACE_MEMBERSHIPS_TABLE,
  SpaceCol,
  SpaceMembershipCol,
  SPACES_TABLE,
} from '@libs/db/shared/space-tables';
import { col, honey, type Expr, type Sql } from '@pkgs/sql';

/**
 * Live spaces this member hosts without having left (left_at set).
 * Fills the create→membership sync gap; excludes post-leave orphans while
 * ended_at is still null.
 */
export function hostedUnleftPredicate(
  spacesAlias: string,
  memberId: string
): Expr {
  return [
    'and',
    ['is-null', `${spacesAlias}.${SpaceCol.endedAt}`],
    [
      'or',
      ['=', `${spacesAlias}.${SpaceCol.hostMemberId}`, memberId],
      ['=', `${spacesAlias}.${SpaceCol.hostAccountId}`, memberId],
    ],
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
              col(`${spacesAlias}.${SpaceCol.id}`),
            ],
            ['=', `m.${SpaceMembershipCol.memberId}`, memberId],
            ['is-not-null', `m.${SpaceMembershipCol.leftAt}`],
          ],
        },
      ],
    ],
  ];
}

/**
 * True when this member is the host and already left — used to keep
 * friends-visibility browse from resurfacing departed-host orphans.
 */
export function departedHostPredicate(
  spacesAlias: string,
  memberId: string
): Expr {
  return [
    'and',
    [
      'or',
      ['=', `${spacesAlias}.${SpaceCol.hostMemberId}`, memberId],
      ['=', `${spacesAlias}.${SpaceCol.hostAccountId}`, memberId],
    ],
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
            col(`${spacesAlias}.${SpaceCol.id}`),
          ],
          ['=', `m.${SpaceMembershipCol.memberId}`, memberId],
          ['is-not-null', `m.${SpaceMembershipCol.leftAt}`],
        ],
      },
    ],
  ];
}

/**
 * Miniplayer hosted-seat SELECT.
 */
export function hostedUnleftSpacesSelectSql(memberId: string): Sql {
  const spaces = SPACES_TABLE.tableName;
  return honey({
    select: [
      SpaceCol.id,
      SpaceCol.hostMemberId,
      SpaceCol.hostAccountId,
      SpaceCol.endedAt,
    ],
    from: spaces,
    where: hostedUnleftPredicate(spaces, memberId),
    orderBy: [[SpaceCol.createdAt, 'desc']],
  });
}

/**
 * Friends lobby live ids: other friends-visible lobbies (not departed-host
 * self), plus active memberships, plus hosted-unleft seats.
 */
export function friendsLiveSpaceIdsSql(args: {
  readonly memberId: string;
  readonly includeHostAccountId: boolean;
}): Sql {
  const spaces = SPACES_TABLE.tableName;
  const memberId = args.memberId;
  const membershipFilter: Expr = args.includeHostAccountId
    ? [
        'or',
        ['=', SpaceMembershipCol.memberId, memberId],
        ['=', SpaceMembershipCol.profileId, memberId],
      ]
    : ['=', SpaceMembershipCol.memberId, memberId];
  return honey({
    select: [SpaceCol.id],
    from: spaces,
    where: [
      'and',
      ['is-null', SpaceCol.endedAt],
      [
        'or',
        [
          'and',
          ['=', SpaceCol.visibility, 'friends'],
          ['not', departedHostPredicate(spaces, memberId)],
        ],
        hostedUnleftPredicate(spaces, memberId),
        [
          'in',
          SpaceCol.id,
          {
            select: [SpaceMembershipCol.spaceId],
            from: SPACE_MEMBERSHIPS_TABLE.tableName,
            where: [
              'and',
              ['is-null', SpaceMembershipCol.leftAt],
              membershipFilter,
            ],
          },
        ],
      ],
    ],
    orderBy: [[SpaceCol.createdAt, 'desc']],
  });
}
