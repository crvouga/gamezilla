/**
 * Rebuilds the `chess_puzzles.sync_pool` flag with the top puzzles per rating
 * band for PowerSync client sync (`WHERE sync_pool = true`).
 */
import { raw, sql } from '@pkgs/sql';
import { createPgPool } from '@pkgs/sql-client/postgres/connect';
import { createPostgresDbScope } from '@pkgs/sql-client/postgres/schema';

const POOL_PER_BAND = 500;
const MAX_BAND = 20;

async function main(): Promise<void> {
  const connectionString = process.env['DATABASE_URL'];
  if (connectionString === undefined || connectionString.length === 0) {
    throw new Error('DATABASE_URL is required');
  }

  const { pool, sqlClient } = createPgPool({
    connectionString,
    dbScope: createPostgresDbScope('public'),
  });

  try {
    // One pooled connection for the whole refresh — TEMP TABLE + updates must
    // share a session (manual BEGIN on a Pool hops connections).
    const count = await sqlClient.transaction(async (tx) => {
      // Avoid `UPDATE chess_puzzles SET sync_pool = false` (rewrites ~6M rows).
      // Flip flags only for the pick set.
      // sqlMap: CREATE TEMP TABLE ... AS SELECT with a ROW_NUMBER() OVER (...)
      // window function — sqlMap has no DDL or window-function support.
      await tx.run(sql<void>`
        CREATE TEMP TABLE puzzle_pool_pick ON COMMIT DROP AS
         SELECT id
         FROM (
           SELECT
             id,
             ROW_NUMBER() OVER (
               PARTITION BY (rating / 400)::integer
               ORDER BY popularity DESC
             ) AS rn
           FROM chess_puzzles
           WHERE rating >= 0 AND (rating / 400)::integer <= ${MAX_BAND}
         ) ranked
         WHERE rn <= ${POOL_PER_BAND}
      `);
      await tx.run(
        raw(`UPDATE chess_puzzles
         SET sync_pool = false
         WHERE sync_pool = true
           AND id NOT IN (SELECT id FROM puzzle_pool_pick)`)
      );
      await tx.run(
        raw(`UPDATE chess_puzzles
         SET sync_pool = true
         WHERE sync_pool = false
           AND id IN (SELECT id FROM puzzle_pool_pick)`)
      );
      const rows = await tx.query(
        raw<{ n: number }>(
          'SELECT count(*)::int AS n FROM chess_puzzles WHERE sync_pool = true'
        )
      );
      return rows[0]?.n ?? 0;
    });
    process.stdout.write(
      `${JSON.stringify({
        refreshed: true,
        rows: count,
        perBand: POOL_PER_BAND,
        maxBand: MAX_BAND,
      })}\n`
    );
  } finally {
    await pool.end();
  }
}

await main();
