import type { SqlTx } from '@pkgs/sql-client-root-shared/interface';
import sql from '@pkgs/sql-root-shared/sql';

/**
 * Loads space ids the member may access via spaces_users ACL
 * (sync upload auth / write context).
 */
export class MemberOfSpaceIdsLoader {
  constructor(private readonly tx: SqlTx) {}

  async load(memberId: string): Promise<string[]> {
    const rows = await this.tx.query(sql<{ readonly space_id: string }>`
      SELECT space_id
      FROM spaces_users
      WHERE user_id = ${memberId}
    `);
    const ids = new Set<string>();
    for (const row of rows) {
      if (row.space_id.length > 0) ids.add(row.space_id);
    }
    return [...ids];
  }
}
