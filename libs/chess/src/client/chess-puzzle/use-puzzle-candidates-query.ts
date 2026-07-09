import { useMemo } from 'react';
import { useWatchQuery } from '@pkgs/sync-engine/client/sync-engine-context';

import {
  buildPuzzleCandidatesSql,
  PUZZLE_NEXT_MAX_BAND,
} from './next-puzzle-id-helpers';

type CandidateRow = { readonly id: string; readonly rating: number };

export function usePuzzleCandidatesQuery(
  rating: number,
  ownerId: string,
  currentPuzzleId: string | null,
  halfWindow: number | null = PUZZLE_NEXT_MAX_BAND,
  pickOffset = 0
) {
  const query = useMemo(
    () =>
      buildPuzzleCandidatesSql(
        rating,
        halfWindow,
        ownerId,
        currentPuzzleId,
        pickOffset
      ),
    [rating, ownerId, currentPuzzleId, halfWindow, pickOffset]
  );
  const { rows, isLoading } = useWatchQuery<CandidateRow>(
    query.sql,
    query.params
  );
  return { rows, isLoading };
}
