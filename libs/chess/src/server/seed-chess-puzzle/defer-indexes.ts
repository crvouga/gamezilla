/**
 * Drop chess-puzzle snapshot secondary indexes before a bulk seed so inserts
 * do not maintain btrees (and any legacy GIN) on managed Postgres tiers with
 * tight storage caps. Re-run `db:migrate` after the seed to recreate indexes
 * from the entity schema registry.
 */
import { CHESS_PUZZLE_ENTITY_TYPE } from '@libs/chess/shared/chess-puzzle-entities';
import type { Logger } from '@pkgs/logger';
import { partitionTableName } from '@pkgs/patch-db/impl-postgres/partitioning';
import type { SqlClient } from '@pkgs/sql-client/interface';

const CHESS_PUZZLE_SNAPSHOTS_TABLE = partitionTableName(
  CHESS_PUZZLE_ENTITY_TYPE
);

const DROP_INDEX_SQL = `
  SELECT indexname
  FROM pg_indexes
  WHERE schemaname = current_schema()
    AND tablename = ?
    AND indexname NOT LIKE '%\\_pkey' ESCAPE '\\'
  ORDER BY indexname
`;

export async function dropPuzzleSnapshotIndexes(args: {
  sql: SqlClient;
  log: Logger;
}): Promise<void> {
  const { sql, log } = args;
  const rows = await sql.query<{ indexname: string }>(DROP_INDEX_SQL, [
    CHESS_PUZZLE_SNAPSHOTS_TABLE,
  ]);
  if (rows.length === 0) {
    log.info('seed:puzzles: defer-indexes — no secondary indexes to drop');
    return;
  }
  log.info(
    'seed:puzzles: defer-indexes — dropping snapshot secondary indexes',
    {
      table: CHESS_PUZZLE_SNAPSHOTS_TABLE,
      count: rows.length,
    }
  );
  for (const { indexname } of rows) {
    try {
      await sql.run(`DROP INDEX IF EXISTS "${indexname}"`);
    } catch (err) {
      log.warn('seed:puzzles: defer-indexes — DROP INDEX failed (continuing)', {
        indexname,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

export function isPostgresStorageLimitError(error: unknown): boolean {
  if (error === null || typeof error !== 'object') return false;
  const code = (error as { code?: unknown }).code;
  return code === '53100';
}

export function formatPostgresStorageLimitError(): string {
  return [
    'Postgres project storage limit exceeded (SQLSTATE 53100).',
    'The full Lichess puzzle dataset (~2.65M rows) needs several GB once',
    'patches + snapshots + btree indexes land — Neon free tier (512 MB) cannot',
    'hold it. Upgrade the production Neon project (Scale / storage add-on),',
    'then re-run this workflow: the seed resumes from the saved cursor.',
    'Also run `db:migrate` after upgrading so chess.puzzle GIN opt-out and',
    'deferred indexes converge.',
  ].join(' ');
}
