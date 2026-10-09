import type { ProductHarness } from '@libs/harness/harness';
import { actorLocalSql } from '@libs/harness/identity';
import sql from '@pkgs/sql-root-shared/sql';

/** Read-only context for a request propagation failure; never an oracle. */
export async function requestSharingDiagnostics(
  s: ProductHarness
): Promise<string> {
  const shared = await s.harness.serverSql.sqlClient.query(sql<
    Record<string, unknown>
  >`
    SELECT status, deleted_at, responded_at FROM friends_requests
  `);
  const copies = await Promise.all(
    [...s.actors.keys()].map(async (actor) => {
      const db = actorLocalSql(s, actor);
      return {
        actor,
        requests: await db?.query(sql<Record<string, unknown>>`
        SELECT status, deleted_at, responded_at FROM friends_requests
      `),
        choices: await db?.query(sql<Record<string, unknown>>`
        SELECT name, seq, deleted_at FROM sync_engine_mutations
        WHERE name IN ('sendFriendRequest', 'declineFriendRequest')
      `),
        markers: await db?.query(sql<Record<string, unknown>>`
          SELECT table_name, row_id, mutation_id, deleted_at
          FROM sync_engine_optimistic_peer_rows
          WHERE table_name = 'friends_requests'
        `),
        refusals: await db?.query(sql<Record<string, unknown>>`
          SELECT mutation_id, code, deleted_at FROM sync_engine_write_rejections
        `),
      };
    })
  );
  return JSON.stringify({ shared, copies });
}
