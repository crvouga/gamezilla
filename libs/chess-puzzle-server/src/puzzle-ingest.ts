/**
 * §23 ingest bookkeeping shared by every seed path: validate each record,
 * count rejections per reason, and split a batch into rows to insert versus
 * duplicates (same id already loaded, or same position + solution under a
 * different id).
 */
import { validatePuzzleRecord } from '@libs/chess-puzzle-shared/puzzle-records';
import { PUZZLE_REJECTION_REASONS } from '@libs/chess-puzzle-shared/puzzle-validation';
import type { PuzzleRejectionReason } from '@libs/chess-puzzle-shared/puzzle-validation';
import type { PuzzleTableRow } from './row';
import { puzzleTableRowOf } from './row';

export const PUZZLE_DUPLICATE_REASONS = [
  'duplicateId',
  'duplicatePosition',
] as const;

export type PuzzleDuplicateReason = (typeof PUZZLE_DUPLICATE_REASONS)[number];

export type PuzzleSkipReason = PuzzleRejectionReason | PuzzleDuplicateReason;

export type PuzzleInsertOutcome = {
  readonly inserted: number;
  readonly duplicateId: number;
  readonly duplicatePosition: number;
};

export type ExistingPuzzleKey = {
  readonly id: string;
  readonly position_key: string | null;
};

export type PuzzleBatchPartition = {
  readonly novel: readonly PuzzleTableRow[];
  readonly duplicateId: number;
  readonly duplicatePosition: number;
};

/**
 * Splits `rows` against keys already stored (`existing`) and earlier rows of
 * the same batch. An id match wins over a position match (a re-run of the
 * same source is not a content duplicate).
 */
export function partitionPuzzleBatch(
  rows: readonly PuzzleTableRow[],
  existing: readonly ExistingPuzzleKey[]
): PuzzleBatchPartition {
  const ids = new Set(existing.map((row) => row.id));
  const keys = new Set(
    existing.flatMap((row) =>
      row.position_key === null ? [] : [row.position_key]
    )
  );
  const novel: PuzzleTableRow[] = [];
  let duplicateId = 0;
  let duplicatePosition = 0;
  for (const row of rows) {
    if (ids.has(row.id)) {
      duplicateId += 1;
      continue;
    }
    if (keys.has(row.position_key)) {
      duplicatePosition += 1;
      continue;
    }
    ids.add(row.id);
    keys.add(row.position_key);
    novel.push(row);
  }
  return { novel, duplicateId, duplicatePosition };
}

/** Per-reason counts of skipped rows plus accepted / inserted totals. */
export class PuzzleIngestTally {
  #accepted = 0;
  #inserted = 0;
  readonly #skipped = new Map<PuzzleSkipReason, number>();

  /** Validates one CSV / stored record; the table row, or null when rejected. */
  accept(record: Readonly<Record<string, unknown>>): PuzzleTableRow | null {
    const result = validatePuzzleRecord(record);
    if (!result.ok) {
      this.#skip(result.reason, 1);
      return null;
    }
    this.#accepted += 1;
    return puzzleTableRowOf(result.puzzle);
  }

  recordInsert(outcome: PuzzleInsertOutcome): void {
    this.#inserted += outcome.inserted;
    this.#skip('duplicateId', outcome.duplicateId);
    this.#skip('duplicatePosition', outcome.duplicatePosition);
  }

  get accepted(): number {
    return this.#accepted;
  }

  get inserted(): number {
    return this.#inserted;
  }

  /** Every skip reason with its count (zeros included, stable order). */
  skipped(): Readonly<Record<PuzzleSkipReason, number>> {
    const out = {} as Record<PuzzleSkipReason, number>;
    for (const reason of [
      ...PUZZLE_REJECTION_REASONS,
      ...PUZZLE_DUPLICATE_REASONS,
    ]) {
      out[reason] = this.#skipped.get(reason) ?? 0;
    }
    return out;
  }

  #skip(reason: PuzzleSkipReason, count: number): void {
    if (count <= 0) return;
    this.#skipped.set(reason, (this.#skipped.get(reason) ?? 0) + count);
  }
}
