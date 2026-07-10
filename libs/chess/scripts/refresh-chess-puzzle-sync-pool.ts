/**
 * Marks the top puzzles per rating band in `chess_puzzles.sync_pool` for
 * PowerSync client sync (the full table is too large to stream to clients).
 */
import { createPgPool } from '@pkgs/sql-client/postgres-connect';
import { createPostgresDbScope } from '@pkgs/sql-client/postgres-schema';

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
    await sqlClient.run('UPDATE chess_puzzles SET sync_pool = false');
    await sqlClient.run(
      `UPDATE chess_puzzles AS p
       SET sync_pool = true
       FROM (
         SELECT id
         FROM (
           SELECT
             id,
             ROW_NUMBER() OVER (
               PARTITION BY (rating / 400)::integer
               ORDER BY popularity DESC
             ) AS rn
           FROM chess_puzzles
           WHERE rating >= 0 AND (rating / 400)::integer <= ?
         ) ranked
         WHERE rn <= ?
       ) pick
       WHERE p.id = pick.id`,
      [MAX_BAND, POOL_PER_BAND]
    );
    const count = await sqlClient.query<{ n: number }>(
      'SELECT count(*)::int AS n FROM chess_puzzles WHERE sync_pool = true'
    );
    process.stdout.write(
      `${JSON.stringify({
        refreshed: true,
        rows: count[0]?.n ?? 0,
        perBand: POOL_PER_BAND,
        maxBand: MAX_BAND,
      })}\n`
    );
  } finally {
    await pool.end();
  }
}

await main();
