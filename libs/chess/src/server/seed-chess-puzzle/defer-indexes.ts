/**
 * Drop chess_puzzles non-unique secondary indexes before a bulk seed so
 * inserts do not maintain btrees on managed Postgres tiers with tight
 * storage caps.
 *
 * Unique indexes (especially business `id`) must stay — seed uses
 * `ON CONFLICT (id)` and the table PK is managed `_id`, not `id`.
 */
import type { Logger } from '@pkgs/logger';
import { raw, sql } from '@pkgs/sql';

import type { SqlClient } from '@pkgs/sql-client/interface';

export async function dropPuzzleSnapshotIndexes(args: {
  db: SqlClient;
  log: Logger;
}): Promise<void> {
  const { db, log } = args;
  const table = 'chess_puzzles';
  // Only non-unique secondary indexes. Unique indexes (ux_*) and the PK
  // remain so ON CONFLICT (id) keeps working after the _id PK migration.
  const rows = await db.query(sql<{ indexname: string }>`
    SELECT i.relname AS indexname
    FROM pg_index x
    JOIN pg_class t ON t.oid = x.indrelid
    JOIN pg_class i ON i.oid = x.indexrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = current_schema()
      AND t.relname = ${table}
      AND x.indisprimary = false
      AND x.indisunique = false
    ORDER BY i.relname
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
