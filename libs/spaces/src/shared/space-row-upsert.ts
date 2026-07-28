import {
  SPACE_MEMBERSHIPS_TABLE,
  SpaceMembershipCol,
} from '@libs/db/shared/space-tables';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { raw, sql } from '@pkgs/sql';

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
    sql`SELECT ${raw(SpaceMembershipCol.id)} AS id
     FROM ${raw(SPACE_MEMBERSHIPS_TABLE.tableName)}
     WHERE ${raw(SpaceMembershipCol.id)} = ${args.membershipId}
     LIMIT 1`
  );
  if (existing[0] === undefined) {
    await args.sql.run(sql`INSERT INTO ${raw(SPACE_MEMBERSHIPS_TABLE.tableName)}
       (${raw(SpaceMembershipCol.id)}, ${raw(SpaceMembershipCol.memberId)},
        ${raw(SpaceMembershipCol.spaceId)}, ${raw(SpaceMembershipCol.joinedAt)},
        ${raw(SpaceMembershipCol.leftAt)}, ${raw(SpaceMembershipCol.profileId)})
       VALUES (${args.membershipId}, ${args.memberId}, ${args.spaceId}, ${args.now}, NULL, ${args.memberId})`);
  } else {
    await args.sql.run(sql`UPDATE ${raw(SPACE_MEMBERSHIPS_TABLE.tableName)}
       SET ${raw(SpaceMembershipCol.leftAt)} = NULL,
           ${raw(SpaceMembershipCol.joinedAt)} = ${args.now},
           ${raw(SpaceMembershipCol.profileId)} = ${args.memberId},
           ${raw(SpaceMembershipCol.memberId)} = ${args.memberId}
       WHERE ${raw(SpaceMembershipCol.id)} = ${args.membershipId}`);
  }
  return { reactivated };
}
