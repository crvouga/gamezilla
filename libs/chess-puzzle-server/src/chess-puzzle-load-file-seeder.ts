/**
 * Seeds `chess_puzzles` from a committed CSV (local sidecar boot, harnesses).
 * Accepts the load-file shape (`id,fen,moves,…`, JSON themes) and the raw
 * Lichess shape (`PuzzleId,FEN,Moves,…`); every record goes through the §23
 * validation pass and the same deduping bulk insert as the streaming seed.
 */
import type { Clock } from '@pkgs/clock-shared/types';
import type { DatabaseSeeder, DatabaseSeederContext } from '@pkgs/db-migrate-shared/database-seeder';
import { readUtf8 } from '@pkgs/object-store-shared/helpers';
import type { ObjectStore } from '@pkgs/object-store-shared/interface';
import type { CreateId } from '@pkgs/uuid-shared/create-id';
import { parse } from 'csv-parse/sync';
import { PuzzleSeedFastPath } from './fast-path';
import { CHESS_PUZZLES_LOAD_FILE_RELATIVE } from './load-file-constants';
import { PuzzleIngestTally } from './puzzle-ingest';
import type { PuzzleSkipReason } from './puzzle-ingest';
import type { PuzzleTableRow } from './row';

const BATCH_SIZE = 250;

export type ChessPuzzleLoadFileSeederArgs = {
  readonly loadFileStore: ObjectStore;
  readonly loadFileKey?: string;
  readonly createId: CreateId;
  readonly now: Clock['now'];
};

export type PuzzleIngestSummary = {
  readonly parsedRows: number;
  readonly validRows: number;
  readonly rowsInserted: number;
  readonly skipped: Readonly<Record<PuzzleSkipReason, number>>;
};

export class ChessPuzzleLoadFileSeeder implements DatabaseSeeder {
  readonly #loadFileStore: ObjectStore;
  readonly #loadFileKey: string;
  readonly #createId: CreateId;
  readonly #now: Clock['now'];

  constructor(args: ChessPuzzleLoadFileSeederArgs) {
    this.#loadFileStore = args.loadFileStore;
    this.#loadFileKey = args.loadFileKey ?? CHESS_PUZZLES_LOAD_FILE_RELATIVE;
    this.#createId = args.createId;
    this.#now = args.now;
  }

  async seed(ctx: DatabaseSeederContext): Promise<void> {
    const summary = await this.ingest(ctx);
    ctx.logger.info('chess-puzzle-load-file: seed complete', {
      loadFileKey: this.#loadFileKey,
      ...summary,
    });
  }

  /** Validates, dedupes and inserts the file; returns per-reason counts. */
  async ingest(ctx: DatabaseSeederContext): Promise<PuzzleIngestSummary> {
    const text = await readUtf8(this.#loadFileStore, this.#loadFileKey);
    if (text === null) {
      throw new Error(`chess puzzle load file not found: ${this.#loadFileKey}`);
    }
    const records = parse(text, {
      columns: true,
      skip_empty_lines: true,
      relax_column_count: true,
      trim: true,
    }) as Record<string, unknown>[];

    const tally = new PuzzleIngestTally();
    const rows: PuzzleTableRow[] = [];
    for (const record of records) {
      const row = tally.accept(record);
      if (row !== null) rows.push(row);
    }

    const fastPath = new PuzzleSeedFastPath(ctx.sqlClient);
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const outcome = await fastPath.insertPuzzleTableRows(
        rows.slice(i, i + BATCH_SIZE),
        { createId: this.#createId, now: this.#now }
      );
      tally.recordInsert(outcome);
    }
    return {
      parsedRows: records.length,
      validRows: tally.accepted,
      rowsInserted: tally.inserted,
      skipped: tally.skipped(),
    };
  }
}
