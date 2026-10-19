import { useMyId } from '@libs/auth-client/use-current-user';
import { puzzleNamespaceCondition } from '@libs/game-puzzle-shared/puzzle-namespace';
import type {
  PuzzleRatingEvent,
  PuzzleRatingEventSqlRow,
} from '@libs/game-puzzle-shared/rating-event';
import { ratingEventFromSql } from '@libs/game-puzzle-shared/rating-event';
import { puzzleStores } from '@libs/game-puzzle-shared/puzzle-tables';
import sql, { raw } from '@pkgs/sql-root-shared/sql';
import { createQuery } from '@pkgs/sync-engine-client/sync-engine-context';
import { type Accessor, createMemo } from 'solid-js';
import { usePuzzleGame } from './puzzle-game-context';

/** Match the sync hydrate limit so the graph sees the whole ledger. */
const RATING_EVENT_LIMIT = 5000;

/**
 * §8 rating ledger for the signed-in player: one row per puzzle that has
 * ever moved their rating. Server-authoritative — the client reads it, it
 * never recomputes it.
 */
export function usePuzzleRatingEvents(): Accessor<
  readonly PuzzleRatingEvent[]
> {
  const myId = useMyId();
  const { namespace } = usePuzzleGame();
  const { rows } = createQuery(
    () => sql<PuzzleRatingEventSqlRow>`
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
      FROM ${raw(puzzleStores.ratingEvents)}
      WHERE owner_id = ${myId()}
        AND deleted_at IS NULL
        AND ${puzzleNamespaceCondition(namespace, 'puzzle_id')}
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
  const events = usePuzzleRatingEvents();
  return createMemo(() =>
    events().some((event) => event.puzzleId === puzzleId())
  );
}
