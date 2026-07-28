import {
  SPACE_MEMBERSHIPS_TABLE,
  SpaceCol,
  SpaceMembershipCol,
  SPACES_TABLE,
} from '@libs/db/shared/space-tables';
import { raw, sql, type Sql } from '@pkgs/sql';

/**
 * Live spaces this member hosts without having left (left_at set).
 * Fills the create→membership sync gap; excludes post-leave orphans while
 * ended_at is still null.
 */
export function hostedUnleftPredicateSql(
  spacesAlias: string,
  memberId: string
): Sql {
  return sql`(
    ${raw(spacesAlias)}.${raw(SpaceCol.endedAt)} IS NULL
    AND (
      ${raw(spacesAlias)}.${raw(SpaceCol.hostMemberId)} = ${memberId}
      OR ${raw(spacesAlias)}.${raw(SpaceCol.hostAccountId)} = ${memberId}
    )
    AND NOT EXISTS (
      SELECT 1 FROM ${raw(SPACE_MEMBERSHIPS_TABLE.tableName)} AS m
      WHERE m.${raw(SpaceMembershipCol.spaceId)} = ${raw(spacesAlias)}.${raw(SpaceCol.id)}
        AND m.${raw(SpaceMembershipCol.memberId)} = ${memberId}
        AND m.${raw(SpaceMembershipCol.leftAt)} IS NOT NULL
    )
  )`;
}

/**
 * True when this member is the host and already left — used to keep
 * friends-visibility browse from resurfacing departed-host orphans.
 */
export function departedHostPredicateSql(
  spacesAlias: string,
  memberId: string
): Sql {
  return sql`(
    (
      ${raw(spacesAlias)}.${raw(SpaceCol.hostMemberId)} = ${memberId}
      OR ${raw(spacesAlias)}.${raw(SpaceCol.hostAccountId)} = ${memberId}
    )
    AND EXISTS (
      SELECT 1 FROM ${raw(SPACE_MEMBERSHIPS_TABLE.tableName)} AS m
      WHERE m.${raw(SpaceMembershipCol.spaceId)} = ${raw(spacesAlias)}.${raw(SpaceCol.id)}
        AND m.${raw(SpaceMembershipCol.memberId)} = ${memberId}
        AND m.${raw(SpaceMembershipCol.leftAt)} IS NOT NULL
    )
  )`;
}

/**
 * Miniplayer hosted-seat SELECT.
 */
export function hostedUnleftSpacesSelectSql(memberId: string): Sql {
  const spaces = SPACES_TABLE.tableName;
  return sql`SELECT ${raw(SpaceCol.id)}, ${raw(SpaceCol.hostMemberId)} AS host_member_id,
          ${raw(SpaceCol.hostAccountId)} AS host_account_id,
          ${raw(SpaceCol.endedAt)} AS ended_at
          FROM ${raw(spaces)}
          WHERE ${hostedUnleftPredicateSql(spaces, memberId)}
          ORDER BY ${raw(SpaceCol.createdAt)} DESC`;
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
  const membershipFilter = args.includeHostAccountId
    ? sql`${raw(SpaceMembershipCol.memberId)} = ${memberId}
                 OR ${raw(SpaceMembershipCol.profileId)} = ${memberId}`
    : sql`${raw(SpaceMembershipCol.memberId)} = ${memberId}`;
  return sql`SELECT ${raw(SpaceCol.id)} AS id FROM ${raw(spaces)}
       WHERE ${raw(SpaceCol.endedAt)} IS NULL
         AND (
           (
             ${raw(SpaceCol.visibility)} = 'friends'
             AND NOT ${departedHostPredicateSql(spaces, memberId)}
           )
           OR ${hostedUnleftPredicateSql(spaces, memberId)}
           OR ${raw(SpaceCol.id)} IN (
             SELECT ${raw(SpaceMembershipCol.spaceId)}
             FROM ${raw(SPACE_MEMBERSHIPS_TABLE.tableName)}
             WHERE ${raw(SpaceMembershipCol.leftAt)} IS NULL
               AND (${membershipFilter})
           )
         )
       ORDER BY ${raw(SpaceCol.createdAt)} DESC`;
}
