/**
 * Drop chess_puzzles non-unique secondary indexes before a bulk seed so
 * inserts do not maintain btrees on managed Postgres tiers with tight
 * storage caps.
 *
 * Unique indexes must stay — the seed dedupes on `id` (PK) and
 * `position_key` (§23). Dropped declared `ix_*` indexes (rating, popularity)
 * come back on the next `db:migrate` schema reconcile.
 */
import type { Logger } from '@pkgs/logger-shared-ts/logger';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import sql, { raw } from '@pkgs/sql-root-shared-ts/sql';

export class PuzzleSnapshotIndexDeferral {
  constructor(
    private readonly db: SqlClient,
    private readonly log: Logger
  ) {}

  async dropIndexes(): Promise<void> {
    const table = 'chess_puzzles';
    // Only non-unique secondary indexes. Unique indexes (ux_*) and the PK
    // remain so ON CONFLICT keeps deduping ids and position keys.
    const rows = await this.db.query(sql<{ indexname: string }>`
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
      this.log.info(
        'seed:puzzles: defer-indexes — no secondary indexes to drop'
      );
      return;
    }
    this.log.info(
      'seed:puzzles: defer-indexes — dropping chess_puzzles secondary indexes',
      {
        table,
        count: rows.length,
      }
    );
    for (const { indexname } of rows) {
      try {
        await this.db.run(raw(`DROP INDEX IF EXISTS "${indexname}"`));
      } catch (err) {
        this.log.warn(
          'seed:puzzles: defer-indexes — drop failed (continuing)',
          {
            indexname,
            error: err instanceof Error ? err.message : String(err),
          }
        );
      }
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
