/**
 * Row sources for the §35 validation job: a CSV (Lichess or load-file shape,
 * plain or `.zst`, via the seed's archive resolver) or the live
 * `chess_puzzles` table, paged by id so the whole database streams in
 * bounded memory.
 */
import { sql } from '@pkgs/sql';
import type { SqlTx } from '@pkgs/sql-client/interface';

import { PuzzleRowIterator } from '../seed-chess-puzzles/puzzle-row-iterator';
import type { ResolvedSource } from '../seed-chess-puzzles/streaming';
import type { PuzzleValidationReport } from './puzzle-validation-report';

const DB_PAGE_SIZE = 5000;

type StoredPuzzleRow = {
  readonly id: string;
  readonly fen: string;
  readonly moves: string;
  readonly rating: number;
  readonly rating_deviation: number;
  readonly popularity: number;
  readonly nb_plays: number;
  readonly themes: unknown;
  readonly game_url: string | null;
  readonly opening_tags: unknown;
};

/** Streams every record of a resolved CSV archive into `report`. */
export async function validatePuzzleArchive(
  resolved: ResolvedSource,
  report: PuzzleValidationReport
): Promise<void> {
  await new PuzzleRowIterator().iterate(resolved, async (record) => {
    report.add(resolved.displayPath, record);
    return true;
  });
}

/** Streams every live `chess_puzzles` row (keyset pages by id) into `report`. */
export async function validatePuzzleTable(
  db: Pick<SqlTx, 'query'>,
  report: PuzzleValidationReport,
  pageSize: number = DB_PAGE_SIZE
): Promise<void> {
  let after = '';
  for (;;) {
    const rows = await db.query(sql<StoredPuzzleRow>`
      SELECT id, fen, moves, rating, rating_deviation, popularity, nb_plays,
        themes, game_url, opening_tags
      FROM chess_puzzles
      WHERE deleted_at IS NULL AND id > ${after}
      ORDER BY id ASC
      LIMIT ${pageSize}
    `);
    for (const row of rows) report.add('chess_puzzles', row);
    const last = rows.at(-1);
    if (last === undefined || rows.length < pageSize) return;
    after = last.id;
  }
}
