import {
  SPACE_MEMBERSHIPS_TABLE,
  SpaceMembershipCol,
} from '@libs/db/shared/space-tables';
import type { SqlClient } from '@pkgs/sql-client/interface';

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
  const reactivated = await wasMembershipInactive(
    args.sql,
    args.membershipId
  );
  const existing = await args.sql.query<{ readonly id: string }>(
    `SELECT ${SpaceMembershipCol.id} AS id
     FROM ${SPACE_MEMBERSHIPS_TABLE.tableName}
     WHERE ${SpaceMembershipCol.id} = ?
     LIMIT 1`,
    [args.membershipId]
  );
  if (existing[0] === undefined) {
    await args.sql.run(
      `INSERT INTO ${SPACE_MEMBERSHIPS_TABLE.tableName}
       (${SpaceMembershipCol.id}, ${SpaceMembershipCol.memberId},
        ${SpaceMembershipCol.spaceId}, ${SpaceMembershipCol.joinedAt},
        ${SpaceMembershipCol.leftAt}, ${SpaceMembershipCol.profileId})
       VALUES (?, ?, ?, ?, NULL, ?)`,
      [
        args.membershipId,
        args.memberId,
        args.spaceId,
        args.now,
        args.memberId,
      ]
    );
  } else {
    await args.sql.run(
      `UPDATE ${SPACE_MEMBERSHIPS_TABLE.tableName}
       SET ${SpaceMembershipCol.leftAt} = NULL,
           ${SpaceMembershipCol.joinedAt} = ?,
           ${SpaceMembershipCol.profileId} = ?,
           ${SpaceMembershipCol.memberId} = ?
       WHERE ${SpaceMembershipCol.id} = ?`,
      [args.now, args.memberId, args.memberId, args.membershipId]
    );
  }
  return { reactivated };
}
