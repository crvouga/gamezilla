import {
  SPACE_MEMBERSHIPS_TABLE,
  SpaceMembershipCol,
} from '@libs/db/shared/space-tables';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { honey } from '@pkgs/sql';

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
    honey({
      select: [SpaceMembershipCol.id],
      from: SPACE_MEMBERSHIPS_TABLE.tableName,
      where: ['=', SpaceMembershipCol.id, args.membershipId],
      limit: 1,
    })
  );
  if (existing[0] === undefined) {
    await args.sql.run(
      honey({
        insertInto: SPACE_MEMBERSHIPS_TABLE.tableName,
        values: {
          [SpaceMembershipCol.id]: args.membershipId,
          [SpaceMembershipCol.memberId]: args.memberId,
          [SpaceMembershipCol.spaceId]: args.spaceId,
          [SpaceMembershipCol.joinedAt]: args.now,
          [SpaceMembershipCol.leftAt]: null,
          [SpaceMembershipCol.profileId]: args.memberId,
        },
      })
    );
  } else {
    await args.sql.run(
      honey({
        update: SPACE_MEMBERSHIPS_TABLE.tableName,
        set: {
          [SpaceMembershipCol.leftAt]: null,
          [SpaceMembershipCol.joinedAt]: args.now,
          [SpaceMembershipCol.profileId]: args.memberId,
          [SpaceMembershipCol.memberId]: args.memberId,
        },
        where: ['=', SpaceMembershipCol.id, args.membershipId],
      })
    );
  }
  return { reactivated };
}
