import { useMyId } from '@libs/auth/client/use-current-user';
import { useEntityAttribute } from '@pkgs/patch-db/react';
import { useMemo } from 'react';

import {
  CHESS_PUZZLE_PROFILE_ENTITY_TYPE,
  ChessPuzzleProfileAttr,
} from '../../shared/chess-puzzle-profile-entities';
import { pickPuzzleIdFromPool, PUZZLE_NEXT_MAX_BAND } from './next-puzzle-id-helpers';
import { usePuzzleCandidatesQuery } from './use-puzzle-candidates-query';

const DEFAULT_RATING = 1200;
const PREFERRED_BAND = 50;

/**
 * Selects the next puzzle id by Elo band (+ widening fallback) excluding
 * puzzles the current user has already interacted with. The exclusion is
 * pushed into the SQL query as a `not_in` subquery against the
 * `chess.puzzle.interaction` partition — no client-side fetch of the
 * interaction list is needed.
 */
export function useNextPuzzleId(args: {
  currentPuzzleId: string | null;
  seed: string;
}): {
  puzzleId: string | null;
  rating: number;
  loading: boolean;
  bandedCount: number;
  fallbackCount: number;
  replayCount: number;
} {
  const { currentPuzzleId, seed } = args;
  const myId = useMyId();

  const profileRating = useEntityAttribute(
    CHESS_PUZZLE_PROFILE_ENTITY_TYPE,
    myId,
    ChessPuzzleProfileAttr.rating
  );
  const rating = profileRating > 0 ? profileRating : DEFAULT_RATING;

  const bandedResult = usePuzzleCandidatesQuery(
    rating,
    myId,
    currentPuzzleId,
    PUZZLE_NEXT_MAX_BAND
  );
  const fallbackResult = usePuzzleCandidatesQuery(
    rating,
    myId,
    currentPuzzleId,
    null
  );
  const replayResult = usePuzzleCandidatesQuery(
    rating,
    '',
    currentPuzzleId,
    null
  );
  const puzzleResult =
    bandedResult.entities.length > 0
      ? bandedResult
      : fallbackResult.entities.length > 0
        ? fallbackResult
        : replayResult;

  const puzzleId = useMemo(
    () =>
      pickPuzzleIdFromPool({
        entities: puzzleResult.entities,
        rating,
        preferredBand: PREFERRED_BAND,
        seed,
      }),
    [puzzleResult.entities, rating, seed]
  );

  const loading =
    myId.length === 0 ||
    bandedResult.isLoading ||
    (bandedResult.entities.length === 0 && fallbackResult.isLoading) ||
    (bandedResult.entities.length === 0 &&
      fallbackResult.entities.length === 0 &&
      replayResult.isLoading);

  return {
    puzzleId,
    rating,
    loading,
    bandedCount: bandedResult.entities.length,
    fallbackCount: fallbackResult.entities.length,
    replayCount: replayResult.entities.length,
  };
}

export { PUZZLE_NEXT_MAX_BAND } from './next-puzzle-id-helpers';
