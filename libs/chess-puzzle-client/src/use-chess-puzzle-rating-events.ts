import { useMyId } from '@libs/auth-client/use-current-user';
import sql from '@pkgs/sql-shared/sql';
import { createQuery } from '@pkgs/sync-engine-client/sync-engine-context';
import { type Accessor, createMemo } from 'solid-js';

import type { ChessPuzzleRatingEvent, ChessPuzzleRatingEventSqlRow } from '@libs/chess-puzzle-shared/chess-puzzle-rating-event';
import { ratingEventFromSql } from '@libs/chess-puzzle-shared/chess-puzzle-rating-event';

/** Match the sync hydrate limit so the graph sees the whole ledger. */
const RATING_EVENT_LIMIT = 5000;

/**
 * §8 rating ledger for the signed-in player: one row per puzzle that has
 * ever moved their rating. Server-authoritative — the client reads it, it
 * never recomputes it.
 */
export function useChessPuzzleRatingEvents(): Accessor<
  readonly ChessPuzzleRatingEvent[]
> {
  const myId = useMyId();
  const { rows } = createQuery(
    () => sql<ChessPuzzleRatingEventSqlRow>`
      SELECT
        puzzle_id,
        puzzle_rating,
        outcome,
        score_permille,
        rating_before,
        rating_after,
        rating_deviation_before,
        rating_deviation_after,
        at
      FROM chess_puzzle_rating_events
      WHERE owner_id = ${myId()}
        AND deleted_at IS NULL
      ORDER BY at ASC
      LIMIT ${RATING_EVENT_LIMIT}
    `
  );
  return createMemo(() => rows().map(ratingEventFromSql));
}

/** Whether this puzzle has already moved the player's rating (§9 unrated). */
export function useIsPuzzleAlreadyRated(
  puzzleId: Accessor<string>
): Accessor<boolean> {
  const events = useChessPuzzleRatingEvents();
  return createMemo(() =>
    events().some((event) => event.puzzleId === puzzleId())
  );
}
