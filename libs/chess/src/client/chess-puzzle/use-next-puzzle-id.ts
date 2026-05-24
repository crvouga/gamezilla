import { useMyId } from '@libs/auth/client/use-current-user';
import { useEntityAttribute } from '@pkgs/patch-db/react';
import { useMemo } from 'react';

import {
  CHESS_PUZZLE_PROFILE_ENTITY_TYPE,
  ChessPuzzleProfileAttr,
} from '../../shared/chess-puzzle-profile-entities';
import { pickPuzzleIdFromPool } from './next-puzzle-id-helpers';
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
}): { puzzleId: string | null; rating: number; loading: boolean } {
  const { currentPuzzleId, seed } = args;
  const myId = useMyId();

  const profileRating = useEntityAttribute(
    CHESS_PUZZLE_PROFILE_ENTITY_TYPE,
    myId,
    ChessPuzzleProfileAttr.rating
  );
  const rating = profileRating > 0 ? profileRating : DEFAULT_RATING;

  const puzzleResult = usePuzzleCandidatesQuery(rating, myId, currentPuzzleId);

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

  return {
    puzzleId,
    rating,
    loading: myId.length === 0 || puzzleResult.isLoading,
  };
}

export { PUZZLE_NEXT_MAX_BAND } from './next-puzzle-id-helpers';
