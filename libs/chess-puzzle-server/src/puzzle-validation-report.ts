/**
 * Accumulates the §35 full-database validation result: every row goes through
 * the §23 validation pass; a row whose position + solution already appeared
 * under another id in the same source (file / table) counts as a
 * `duplicatePosition` failure.
 */
import { validatePuzzleRecord } from '@libs/chess-puzzle-shared/puzzle-records';
import type { PuzzleRejectionReason } from '@libs/chess-puzzle-shared/puzzle-validation';
import { PUZZLE_REJECTION_REASONS } from '@libs/chess-puzzle-shared/puzzle-validation';

export type PuzzleValidationFailureReason =
  | PuzzleRejectionReason
  | 'duplicatePosition';

export type PuzzleValidationFailure = {
  readonly source: string;
  readonly id: string;
  readonly reason: PuzzleValidationFailureReason;
  readonly detail: string;
};

export type PuzzleValidationSummary = {
  readonly checked: number;
  readonly valid: number;
  readonly invalid: number;
  readonly byReason: Readonly<Record<PuzzleValidationFailureReason, number>>;
  /** First failures, for the log (bounded). */
  readonly samples: readonly PuzzleValidationFailure[];
};

const DEFAULT_MAX_SAMPLES = 20;

export class PuzzleValidationReport {
  readonly #maxSamples: number;
  readonly #positionKeys = new Map<string, string>();
  readonly #byReason = new Map<PuzzleValidationFailureReason, number>();
  readonly #samples: PuzzleValidationFailure[] = [];
  #checked = 0;
  #valid = 0;

  constructor(maxSamples: number = DEFAULT_MAX_SAMPLES) {
    this.#maxSamples = maxSamples;
  }

  /** Validates one CSV / stored record from `source` (file or table name). */
  add(source: string, record: Readonly<Record<string, unknown>>): void {
    this.#checked += 1;
    const result = validatePuzzleRecord(record);
    if (!result.ok) {
      const { id, reason, detail } = result;
      this.#fail({ source, id, reason, detail });
      return;
    }
    const { id } = result.puzzle;
    const positionKey = `${source}\u0000${result.puzzle.positionKey}`;
    const firstId = this.#positionKeys.get(positionKey);
    if (firstId !== undefined && firstId !== id) {
      this.#fail({
        source,
        id,
        reason: 'duplicatePosition',
        detail: `same position + solution as ${firstId}`,
      });
      return;
    }
    this.#positionKeys.set(positionKey, id);
    this.#valid += 1;
  }

  get failed(): boolean {
    return this.#checked !== this.#valid;
  }

  summary(): PuzzleValidationSummary {
    const byReason = {} as Record<PuzzleValidationFailureReason, number>;
    for (const reason of [
      ...PUZZLE_REJECTION_REASONS,
      'duplicatePosition',
    ] as const) {
      byReason[reason] = this.#byReason.get(reason) ?? 0;
    }
    return {
      checked: this.#checked,
      valid: this.#valid,
      invalid: this.#checked - this.#valid,
      byReason,
      samples: [...this.#samples],
    };
  }

  #fail(failure: PuzzleValidationFailure): void {
    this.#byReason.set(
      failure.reason,
      (this.#byReason.get(failure.reason) ?? 0) + 1
    );
    if (this.#samples.length < this.#maxSamples) this.#samples.push(failure);
  }
}
