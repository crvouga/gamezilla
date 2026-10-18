/**
 * What someone listening to the app hears of a puzzle attempt's results,
 * whichever game it is of, as plain parts the platform words in its live
 * region: a wrong move, the solve, the solution shown or a skip, and the
 * rating change (or that the attempt was unrated). What a game says of its
 * own moves is its companion's.
 */

import type { PuzzleCompletion } from './completion';
import type { SolveStatus } from './solve-status';

export type PuzzleResultPart =
  | { readonly kind: 'wrong' }
  | { readonly kind: 'solved' }
  | { readonly kind: 'revealed' }
  | { readonly kind: 'skipped' }
  | {
      readonly kind: 'ratingChange';
      readonly delta: number;
      readonly ratingAfter: number;
    }
  | { readonly kind: 'unrated' };

export type PuzzleResultAnnouncementInput = {
  readonly status: SolveStatus;
  readonly completion: PuzzleCompletion | null;
};

const FINISHED: Partial<Record<SolveStatus, PuzzleResultPart>> = {
  solved: { kind: 'solved' },
  revealed: { kind: 'revealed' },
  skipped: { kind: 'skipped' },
};

/** The parts heard of the attempt's results as it stands; none while solving. */
export function puzzleResultAnnouncement(
  input: PuzzleResultAnnouncementInput
): readonly PuzzleResultPart[] {
  if (input.status === 'wrong') return [{ kind: 'wrong' }];
  const done = FINISHED[input.status];
  if (done === undefined) return [];
  const completion = input.completion;
  if (completion === null) return [done];
  if (!completion.rated) return [done, { kind: 'unrated' }];
  return [
    done,
    {
      kind: 'ratingChange',
      delta: completion.delta,
      ratingAfter: completion.ratingAfter,
    },
  ];
}
