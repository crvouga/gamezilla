import {
  SPACE_MEMBERSHIPS_TABLE,
  SpaceMembershipCol,
} from '@libs/db/shared/space-tables';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { sql, ident } from '@pkgs/sql';

import { wasMembershipInactive } from './space-write-helpers';

/**
 * Insert-or-update for PowerSync synced tables (SQLite views).
 * `INSERT … ON CONFLICT` is rejected with "cannot UPSERT a view".
 */
export async function upsertSpaceMembershipRow(args: {
  readonly sql: SqlClient;
  readonly membershipId: string;
  readonly memberId: string;
  readonly spaceId: string;
  readonly now: string;
}): Promise<{ readonly reactivated: boolean }> {
  const reactivated = await wasMembershipInactive(args.sql, args.membershipId);
  const existing = await args.sql.query<{ readonly id: string }>(
    sql`SELECT ${ident(SpaceMembershipCol.id)} AS id
     FROM ${ident(SPACE_MEMBERSHIPS_TABLE.tableName)}
     WHERE ${ident(SpaceMembershipCol.id)} = ${args.membershipId}
     LIMIT 1`
  );
  if (existing[0] === undefined) {
    await args.sql.run(sql`INSERT INTO ${ident(SPACE_MEMBERSHIPS_TABLE.tableName)}
       (${ident(SpaceMembershipCol.id)}, ${ident(SpaceMembershipCol.memberId)},
        ${ident(SpaceMembershipCol.spaceId)}, ${ident(SpaceMembershipCol.joinedAt)},
        ${ident(SpaceMembershipCol.leftAt)}, ${ident(SpaceMembershipCol.profileId)})
       VALUES (${args.membershipId}, ${args.memberId}, ${args.spaceId}, ${args.now}, NULL, ${args.memberId})`);
  } else {
    await args.sql.run(sql`UPDATE ${ident(SPACE_MEMBERSHIPS_TABLE.tableName)}
       SET ${ident(SpaceMembershipCol.leftAt)} = NULL,
           ${ident(SpaceMembershipCol.joinedAt)} = ${args.now},
           ${ident(SpaceMembershipCol.profileId)} = ${args.memberId},
           ${ident(SpaceMembershipCol.memberId)} = ${args.memberId}
       WHERE ${ident(SpaceMembershipCol.id)} = ${args.membershipId}`);
  }
  return { reactivated };
}
