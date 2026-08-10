import { sql } from '@pkgs/sql';

import type { SqlClient } from '@pkgs/sql-client/interface';
import { canonicalUserPair } from '../canonical-pair';
import { pairId } from '../pair-id';

type Db = Pick<SqlClient, 'query' | 'run'>;

export class FriendshipRepository {
  constructor(private readonly db: Db) {}

  async exists(userA: string, userB: string): Promise<boolean> {
    const { userLow, userHigh } = canonicalUserPair(userA, userB);
    const rows = await this.db.query(sql<Record<string, unknown>>`
      SELECT id
      FROM friendships
      WHERE user_low = ${userLow}
        AND user_high = ${userHigh}
        AND deleted_at IS NULL
      LIMIT 1
    `);
    return rows.length > 0;
  }

  async insert(args: {
    readonly userA: string;
    readonly userB: string;
    readonly sourceRequestId: string;
    readonly now: string;
  }): Promise<void> {
    const { userLow, userHigh } = canonicalUserPair(args.userA, args.userB);
    await this.db.run(sql<void>`
      INSERT INTO friendships (id, user_low, user_high, created_at, source_request_id, deleted_at)
      VALUES (
        ${pairId(userLow, userHigh)},
        ${userLow},
        ${userHigh},
        ${args.now},
        ${args.sourceRequestId},
        ${null}
      )
      ON CONFLICT (user_low, user_high) DO UPDATE SET
        deleted_at = NULL,
        created_at = excluded.created_at,
        source_request_id = excluded.source_request_id
    `);
  }

  async softDelete(userA: string, userB: string, now: string): Promise<void> {
    const { userLow, userHigh } = canonicalUserPair(userA, userB);
    await this.db.run(sql<void>`
      UPDATE friendships
      SET deleted_at = ${now}
      WHERE user_low = ${userLow}
        AND user_high = ${userHigh}
        AND deleted_at IS NULL
    `);
  }

  /** Soft-delete and bump updated_at (server block path). */
  async delete(userA: string, userB: string, now: string): Promise<void> {
    const { userLow, userHigh } = canonicalUserPair(userA, userB);
    await this.db.run(sql<void>`
      UPDATE friendships
      SET deleted_at = ${now}, updated_at = ${now}
      WHERE user_low = ${userLow}
        AND user_high = ${userHigh}
        AND deleted_at IS NULL
    `);
  }
}
