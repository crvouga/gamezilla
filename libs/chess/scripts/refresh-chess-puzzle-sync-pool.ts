/**
 * Rebuilds `chess_puzzle_sync_pool` (and the `chess_puzzles.sync_pool` flag)
 * with the top puzzles per rating band for PowerSync client sync.
 *
 * PowerSync replicates every table referenced by sync streams in full.
 * Streaming from `chess_puzzles` (~6M rows) freezes client downloads; the
 * pool table stays ~4k rows so replication and bucket serving stay cheap.
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
    // Avoid `UPDATE chess_puzzles SET sync_pool = false` (rewrites ~6M rows).
    // Rebuild the small mirror first, then flip flags only for the pick set.
    await sqlClient.run('BEGIN');
    await sqlClient.run(
      `CREATE TEMP TABLE puzzle_pool_pick ON COMMIT DROP AS
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
       WHERE rn <= ?`,
      [MAX_BAND, POOL_PER_BAND]
    );
    await sqlClient.run('DELETE FROM chess_puzzle_sync_pool');
    await sqlClient.run(
      `INSERT INTO chess_puzzle_sync_pool (
         id, fen, moves, rating, rating_deviation, popularity, nb_plays,
         themes, game_url, opening_tags
       )
       SELECT
         p.id, p.fen, p.moves, p.rating, p.rating_deviation, p.popularity,
         p.nb_plays, p.themes, p.game_url, p.opening_tags
       FROM chess_puzzles p
       INNER JOIN puzzle_pool_pick pick ON pick.id = p.id`
    );
    await sqlClient.run(
      `UPDATE chess_puzzles
       SET sync_pool = false
       WHERE sync_pool = true
         AND id NOT IN (SELECT id FROM puzzle_pool_pick)`
    );
    await sqlClient.run(
      `UPDATE chess_puzzles
       SET sync_pool = true
       WHERE sync_pool = false
         AND id IN (SELECT id FROM puzzle_pool_pick)`
    );
    await sqlClient.run('COMMIT');
    const count = await sqlClient.query<{ n: number }>(
      'SELECT count(*)::int AS n FROM chess_puzzle_sync_pool'
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
    await sqlClient.run('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    await pool.end();
  }
}

await main();
