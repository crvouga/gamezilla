import {
  SPACE_MEMBERSHIPS_TABLE,
  SpaceCol,
  SpaceMembershipCol,
  SPACES_TABLE,
} from '@libs/db/shared/space-tables';
import { sql, type Sql, ident } from '@pkgs/sql';

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
    ${ident(spacesAlias)}.${ident(SpaceCol.endedAt)} IS NULL
    AND (
      ${ident(spacesAlias)}.${ident(SpaceCol.hostMemberId)} = ${memberId}
      OR ${ident(spacesAlias)}.${ident(SpaceCol.hostAccountId)} = ${memberId}
    )
    AND NOT EXISTS (
      SELECT 1 FROM ${ident(SPACE_MEMBERSHIPS_TABLE.tableName)} AS m
      WHERE m.${ident(SpaceMembershipCol.spaceId)} = ${ident(spacesAlias)}.${ident(SpaceCol.id)}
        AND m.${ident(SpaceMembershipCol.memberId)} = ${memberId}
        AND m.${ident(SpaceMembershipCol.leftAt)} IS NOT NULL
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
      ${ident(spacesAlias)}.${ident(SpaceCol.hostMemberId)} = ${memberId}
      OR ${ident(spacesAlias)}.${ident(SpaceCol.hostAccountId)} = ${memberId}
    )
    AND EXISTS (
      SELECT 1 FROM ${ident(SPACE_MEMBERSHIPS_TABLE.tableName)} AS m
      WHERE m.${ident(SpaceMembershipCol.spaceId)} = ${ident(spacesAlias)}.${ident(SpaceCol.id)}
        AND m.${ident(SpaceMembershipCol.memberId)} = ${memberId}
        AND m.${ident(SpaceMembershipCol.leftAt)} IS NOT NULL
    )
  )`;
}

/**
 * Miniplayer hosted-seat SELECT.
 */
export function hostedUnleftSpacesSelectSql(memberId: string): Sql {
  const spaces = SPACES_TABLE.tableName;
  return sql`SELECT ${ident(SpaceCol.id)}, ${ident(SpaceCol.hostMemberId)} AS host_member_id,
          ${ident(SpaceCol.hostAccountId)} AS host_account_id,
          ${ident(SpaceCol.endedAt)} AS ended_at
          FROM ${ident(spaces)}
          WHERE ${hostedUnleftPredicateSql(spaces, memberId)}
          ORDER BY ${ident(SpaceCol.createdAt)} DESC`;
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
    ? sql`${ident(SpaceMembershipCol.memberId)} = ${memberId}
                 OR ${ident(SpaceMembershipCol.profileId)} = ${memberId}`
    : sql`${ident(SpaceMembershipCol.memberId)} = ${memberId}`;
  return sql`SELECT ${ident(SpaceCol.id)} AS id FROM ${ident(spaces)}
       WHERE ${ident(SpaceCol.endedAt)} IS NULL
         AND (
           (
             ${ident(SpaceCol.visibility)} = 'friends'
             AND NOT ${departedHostPredicateSql(spaces, memberId)}
           )
           OR ${hostedUnleftPredicateSql(spaces, memberId)}
           OR ${ident(SpaceCol.id)} IN (
             SELECT ${ident(SpaceMembershipCol.spaceId)}
             FROM ${ident(SPACE_MEMBERSHIPS_TABLE.tableName)}
             WHERE ${ident(SpaceMembershipCol.leftAt)} IS NULL
               AND (${membershipFilter})
           )
         )
       ORDER BY ${ident(SpaceCol.createdAt)} DESC`;
}
