/**
 * Seeds `chess_puzzles` from the committed CSV load file (local sidecar boot).
 */
import { readFile } from 'node:fs/promises';
import type { Clock } from '@pkgs/clock';
import type { DatabaseSeeder, DatabaseSeederContext } from '@pkgs/db-migrate';
import type { CreateId } from '@pkgs/uuid';
import { parse } from 'csv-parse/sync';
import { insertPuzzleTableRows } from './fast-path';
import { resolveChessPuzzlesLoadFilePath } from './load-file';
import type { PuzzleTableRow } from './row';

const BATCH_SIZE = 250;

export type ChessPuzzleLoadFileSeederArgs = {
  readonly loadFilePath?: string;
  readonly createId: CreateId;
  readonly now: Clock['now'];
};

function readNonNegativeInt(raw: unknown): number {
  const n = Number.parseInt(String(raw ?? ''), 10);
  return Number.isFinite(n) ? n : 0;
}

function jsonCellToString(raw: unknown): string {
  if (raw === null || raw === undefined || raw === '') return '[]';
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed.length === 0) return '[]';
    try {
      JSON.parse(trimmed);
      return trimmed;
    } catch {
      return JSON.stringify(
        trimmed
          .split(/\s+/)
          .map((s) => s.trim())
          .filter((s) => s.length > 0)
      );
    }
  }
  return JSON.stringify(raw);
}

function csvRecordToPuzzleTableRow(
  row: Record<string, unknown>
): PuzzleTableRow | null {
  const id = String(row['id'] ?? '').trim();
  const fen = String(row['fen'] ?? '').trim();
  const moves = String(row['moves'] ?? '').trim();
  if (id.length === 0 || fen.length === 0 || moves.length === 0) return null;
  const gameUrlRaw = row['game_url'];
  const gameUrl =
    typeof gameUrlRaw === 'string' && gameUrlRaw.trim().length > 0
      ? gameUrlRaw.trim()
      : null;
  return {
    id,
    fen,
    moves,
    rating: readNonNegativeInt(row['rating']),
    rating_deviation: readNonNegativeInt(row['rating_deviation']),
    popularity: readNonNegativeInt(row['popularity']),
    nb_plays: readNonNegativeInt(row['nb_plays']),
    themes: jsonCellToString(row['themes']),
    game_url: gameUrl,
    opening_tags: jsonCellToString(row['opening_tags']),
  };
}

export class ChessPuzzleLoadFileSeeder implements DatabaseSeeder {
  readonly #loadFilePath: string;
  readonly #createId: CreateId;
  readonly #now: Clock['now'];

  constructor(args: ChessPuzzleLoadFileSeederArgs) {
    this.#loadFilePath = args.loadFilePath ?? resolveChessPuzzlesLoadFilePath();
    this.#createId = args.createId;
    this.#now = args.now;
  }

  async seed(ctx: DatabaseSeederContext): Promise<void> {
    const { sqlClient, logger } = ctx;
    const text = await readFile(this.#loadFilePath, 'utf8');
    const records = parse(text, {
      columns: true,
      skip_empty_lines: true,
      relax_column_count: true,
      trim: true,
    }) as Record<string, unknown>[];

    const rows: PuzzleTableRow[] = [];
    for (const record of records) {
      const mapped = csvRecordToPuzzleTableRow(record);
      if (mapped !== null) rows.push(mapped);
    }

    let inserted = 0;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      inserted += await insertPuzzleTableRows(sqlClient, batch, {
        createId: this.#createId,
        now: this.#now,
      });
    }

    logger.info('chess-puzzle-load-file: seed complete', {
      loadFilePath: this.#loadFilePath,
      parsedRows: rows.length,
      rowsInserted: inserted,
    });
  }
}
