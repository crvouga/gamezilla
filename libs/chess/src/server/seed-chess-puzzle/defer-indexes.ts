/**
 * Drop chess_puzzles secondary indexes before a bulk seed so inserts do not
 * maintain btrees on managed Postgres tiers with tight storage caps.
 */
import { CHESS_PUZZLES_TABLE } from '@libs/db/shared/chess-tables';
import type { Logger } from '@pkgs/logger';
import { raw, sql } from '@pkgs/sql';

import type { SqlClient } from '@pkgs/sql-client/interface';

export async function dropPuzzleSnapshotIndexes(args: {
  db: SqlClient;
  log: Logger;
}): Promise<void> {
  const { db, log } = args;
  const table = CHESS_PUZZLES_TABLE.tableName;
  const rows = await db.query<{ indexname: string }>(sql`
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname = current_schema()
      AND tablename = ${table}
      AND indexname NOT LIKE '%\_pkey' ESCAPE '\'
    ORDER BY indexname
  `);
  if (rows.length === 0) {
    log.info('seed:puzzles: defer-indexes — no secondary indexes to drop');
    return;
  }
  log.info(
    'seed:puzzles: defer-indexes — dropping chess_puzzles secondary indexes',
    {
      table,
      count: rows.length,
    }
  );
  for (const { indexname } of rows) {
    try {
      await db.run(raw(`DROP INDEX IF EXISTS "${indexname}"`));
    } catch (err) {
      log.warn('seed:puzzles: defer-indexes — drop failed (continuing)', {
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
    'chess_puzzles + btree indexes land — upgrade hosted Postgres storage,',
    'then re-run this workflow: the seed resumes from the saved cursor.',
  ].join(' ');
}
