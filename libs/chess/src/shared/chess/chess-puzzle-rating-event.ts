/**
 * §8 rating ledger: one row per puzzle a player's rating has ever moved for.
 *
 * The row id is `<ownerId>|<puzzleId>`, so the primary key *is* the "one
 * rating change per puzzle, ever" invariant: a repeat attempt, a duplicated
 * upload and an out-of-order replay all collide on the same id and are
 * dropped. It doubles as the §8 `P1` rating history the stats graphs read.
 */

import type { ChessPuzzleOutcomeKind } from './chess-puzzle-interaction-entities';

export const CHESS_PUZZLE_RATING_EVENT_ID_SEPARATOR = '|';

/** Deterministic id: the same attempt always addresses the same row. */
export function chessPuzzleRatingEventId(
  ownerId: string,
  puzzleId: string
): string {
  return `${ownerId}${CHESS_PUZZLE_RATING_EVENT_ID_SEPARATOR}${puzzleId}`;
}

export type ChessPuzzleRatingEvent = {
  readonly puzzleId: string;
  readonly puzzleRating: number;
  readonly outcome: ChessPuzzleOutcomeKind;
  readonly scorePermille: number;
  readonly ratingBefore: number;
  readonly ratingAfter: number;
  readonly ratingDeviationBefore: number;
  readonly ratingDeviationAfter: number;
  readonly at: string;
};

export type ChessPuzzleRatingEventSqlRow = {
  readonly puzzle_id: string;
  readonly puzzle_rating: number | null;
  readonly outcome: string;
  readonly score_permille: number | null;
  readonly rating_before: number | null;
  readonly rating_after: number | null;
  readonly rating_deviation_before: number | null;
  readonly rating_deviation_after: number | null;
  readonly at: string;
};

function intOf(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : fallback;
}

function outcomeOf(value: unknown): ChessPuzzleOutcomeKind {
  return value === 'solved' || value === 'abandoned' ? value : 'failed';
}

export function ratingEventFromSql(
  row: ChessPuzzleRatingEventSqlRow
): ChessPuzzleRatingEvent {
  return {
    puzzleId: row.puzzle_id,
    puzzleRating: intOf(row.puzzle_rating, 0),
    outcome: outcomeOf(row.outcome),
    scorePermille: intOf(row.score_permille, 0),
    ratingBefore: intOf(row.rating_before, 0),
    ratingAfter: intOf(row.rating_after, 0),
    ratingDeviationBefore: intOf(row.rating_deviation_before, 0),
    ratingDeviationAfter: intOf(row.rating_deviation_after, 0),
    at: row.at,
  };
}

/** Rating change of one event (always `after − before`). */
export function ratingEventDelta(event: ChessPuzzleRatingEvent): number {
  return event.ratingAfter - event.ratingBefore;
}
