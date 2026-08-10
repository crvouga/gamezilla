import { sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';

/**
 * Space ids the actor can see via mySpaces scope: host (member or account)
 * OR spaces_users membership. Used for pubsub ACL + channel derivation.
 */
export class MySpaceIdsLoader {
  constructor(private readonly db: SqlClient) {}

  async load(actorId: string): Promise<string[]> {
    const rows = await this.db.query(sql<{ readonly id: string }>`
      SELECT id
      FROM spaces
      WHERE host_member_id = ${actorId}
         OR host_account_id = ${actorId}
         OR id IN (
           SELECT space_id FROM spaces_users WHERE user_id = ${actorId}
         )
    `);
    const ids = new Set<string>();
    for (const row of rows) {
      if (row.id.length > 0) ids.add(row.id);
    }
    return [...ids];
  }
}
