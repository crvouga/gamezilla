import {
  SPACE_MEMBERSHIPS_TABLE,
  SpaceCol,
  SpaceMembershipCol,
  SPACES_TABLE,
} from '@libs/db/shared/space-tables';

export type SqlQuery = {
  readonly sql: string;
  readonly params: readonly string[];
};

/**
 * Live spaces this member hosts without having left (left_at set).
 * Fills the create→membership sync gap; excludes post-leave orphans while
 * ended_at is still null.
 *
 * Params: [memberId, memberId, memberId]
 */
export function hostedUnleftPredicateSql(spacesAlias: string): string {
  return `(
    ${spacesAlias}.${SpaceCol.endedAt} IS NULL
    AND (
      ${spacesAlias}.${SpaceCol.hostMemberId} = ?
      OR ${spacesAlias}.${SpaceCol.hostAccountId} = ?
    )
    AND NOT EXISTS (
      SELECT 1 FROM ${SPACE_MEMBERSHIPS_TABLE.tableName} AS m
      WHERE m.${SpaceMembershipCol.spaceId} = ${spacesAlias}.${SpaceCol.id}
        AND m.${SpaceMembershipCol.memberId} = ?
        AND m.${SpaceMembershipCol.leftAt} IS NOT NULL
    )
  )`;
}

/**
 * True when this member is the host and already left — used to keep
 * friends-visibility browse from resurfacing departed-host orphans.
 *
 * Params: [memberId, memberId, memberId]
 */
export function departedHostPredicateSql(spacesAlias: string): string {
  return `(
    (
      ${spacesAlias}.${SpaceCol.hostMemberId} = ?
      OR ${spacesAlias}.${SpaceCol.hostAccountId} = ?
    )
    AND EXISTS (
      SELECT 1 FROM ${SPACE_MEMBERSHIPS_TABLE.tableName} AS m
      WHERE m.${SpaceMembershipCol.spaceId} = ${spacesAlias}.${SpaceCol.id}
        AND m.${SpaceMembershipCol.memberId} = ?
        AND m.${SpaceMembershipCol.leftAt} IS NOT NULL
    )
  )`;
}

/**
 * Miniplayer hosted-seat SELECT. Params: [memberId, memberId, memberId].
 */
export function hostedUnleftSpacesSelectSql(memberId: string): SqlQuery {
  const spaces = SPACES_TABLE.tableName;
  return {
    sql: `SELECT ${SpaceCol.id}, ${SpaceCol.hostMemberId} AS host_member_id,
          ${SpaceCol.hostAccountId} AS host_account_id,
          ${SpaceCol.endedAt} AS ended_at
          FROM ${spaces}
          WHERE ${hostedUnleftPredicateSql(spaces)}
          ORDER BY ${SpaceCol.createdAt} DESC`,
    params: [memberId, memberId, memberId],
  };
}

/**
 * Friends lobby live ids: other friends-visible lobbies (not departed-host
 * self), plus active memberships, plus hosted-unleft seats.
 */
export function friendsLiveSpaceIdsSql(args: {
  readonly memberId: string;
  readonly includeHostAccountId: boolean;
}): SqlQuery {
  const spaces = SPACES_TABLE.tableName;
  const memberId = args.memberId;
  if (args.includeHostAccountId) {
    return {
      sql: `SELECT ${SpaceCol.id} AS id FROM ${spaces}
         WHERE ${SpaceCol.endedAt} IS NULL
           AND (
             (
               ${SpaceCol.visibility} = 'friends'
               AND NOT ${departedHostPredicateSql(spaces)}
             )
             OR ${hostedUnleftPredicateSql(spaces)}
             OR ${SpaceCol.id} IN (
               SELECT ${SpaceMembershipCol.spaceId}
               FROM ${SPACE_MEMBERSHIPS_TABLE.tableName}
               WHERE ${SpaceMembershipCol.leftAt} IS NULL
                 AND (
                   ${SpaceMembershipCol.memberId} = ?
                   OR ${SpaceMembershipCol.profileId} = ?
                 )
             )
           )
         ORDER BY ${SpaceCol.createdAt} DESC`,
      // friends NOT departed: 3, hosted-unleft: 3, membership: 2
      params: [
        memberId,
        memberId,
        memberId,
        memberId,
        memberId,
        memberId,
        memberId,
        memberId,
      ],
    };
  }
  return {
    sql: `SELECT ${SpaceCol.id} AS id FROM ${spaces}
       WHERE ${SpaceCol.endedAt} IS NULL
         AND (
           (
             ${SpaceCol.visibility} = 'friends'
             AND NOT ${departedHostPredicateSql(spaces)}
           )
           OR ${hostedUnleftPredicateSql(spaces)}
           OR ${SpaceCol.id} IN (
             SELECT ${SpaceMembershipCol.spaceId}
             FROM ${SPACE_MEMBERSHIPS_TABLE.tableName}
             WHERE ${SpaceMembershipCol.leftAt} IS NULL
               AND ${SpaceMembershipCol.memberId} = ?
           )
         )
       ORDER BY ${SpaceCol.createdAt} DESC`,
    // friends NOT departed: 3, hosted-unleft: 3, membership: 1
    // departedHost uses hostMemberId OR hostAccountId — for device-only the
    // same device id is bound to both host slots.
    params: [
      memberId,
      memberId,
      memberId,
      memberId,
      memberId,
      memberId,
      memberId,
    ],
  };
}
