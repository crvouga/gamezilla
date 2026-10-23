import { actorVisibleLiveSpacesPredicateSql } from '@libs/spaces-shared-ts/actor-visible-spaces-sql';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import sql from '@pkgs/sql-root-shared-ts/sql';

/**
 * Space ids the actor can see via mySpaces scope: host (member or account),
 * spaces_users membership, or a friend's live space. Used for pubsub ACL.
 */
export class MySpaceIdsLoader {
  constructor(private readonly db: SqlClient) {}

  async load(actorId: string): Promise<string[]> {
    const visible = actorVisibleLiveSpacesPredicateSql(actorId);
    const rows = await this.db.query(sql<{ readonly id: string }>`
      SELECT id
      FROM spaces
      WHERE ${visible}
    `);
    const ids = new Set<string>();
    for (const row of rows) {
      if (row.id.length > 0) ids.add(row.id);
    }
    return [...ids];
  }
}
