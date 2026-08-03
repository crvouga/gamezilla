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
    // Avoid `UPDATE chess_puzzles SET sync_pool = false` (rewrites ~6M rows).
    // Flip flags only for the pick set.
    await sqlClient.run(raw('BEGIN'));
    // sqlMap: CREATE TEMP TABLE ... AS SELECT with a ROW_NUMBER() OVER (...)
    // window function — sqlMap has no DDL or window-function support.
    await sqlClient.run(sql<void>`
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
    await sqlClient.run(
      raw(`UPDATE chess_puzzles
       SET sync_pool = false
       WHERE sync_pool = true
         AND id NOT IN (SELECT id FROM puzzle_pool_pick)`)
    );
    await sqlClient.run(
      raw(`UPDATE chess_puzzles
       SET sync_pool = true
       WHERE sync_pool = false
         AND id IN (SELECT id FROM puzzle_pool_pick)`)
    );
    await sqlClient.run(raw('COMMIT'));
    const count = await sqlClient.query(
      raw<{ n: number }>(
        'SELECT count(*)::int AS n FROM chess_puzzles WHERE sync_pool = true'
      )
    );
    process.stdout.write(
      `${JSON.stringify({
        refreshed: true,
        rows: count[0]?.n ?? 0,
        perBand: POOL_PER_BAND,
        maxBand: MAX_BAND,
      })}\n`
    );
  } catch (error) {
    await sqlClient.run(raw('ROLLBACK')).catch(() => undefined);
    throw error;
  } finally {
    await pool.end();
  }
}

await main();
