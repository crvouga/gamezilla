import { sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';

import { actorVisibleLiveSpacesPredicateSql } from '../../shared/space/actor-visible-spaces-sql';

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
