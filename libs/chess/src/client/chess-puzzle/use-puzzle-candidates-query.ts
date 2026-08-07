import { useQuery } from '@pkgs/sync-engine/client';
import { useMemo } from 'react';

import {
  buildPuzzleCandidatesSql,
  PUZZLE_NEXT_MAX_BAND,
} from './next-puzzle-id-helpers';

export type PuzzleCandidatesQueryArgs = {
  readonly rating: number;
  readonly ownerId: string;
  readonly currentPuzzleId: string | null;
  readonly halfWindow?: number | null;
  readonly pickOffset?: number;
};

export function usePuzzleCandidatesQuery(args: PuzzleCandidatesQueryArgs) {
  const halfWindow = args.halfWindow ?? PUZZLE_NEXT_MAX_BAND;
  const pickOffset = args.pickOffset ?? 0;
  const query = useMemo(
    () =>
      buildPuzzleCandidatesSql({
        rating: args.rating,
        halfWindow,
        ownerId: args.ownerId,
        currentPuzzleId: args.currentPuzzleId,
        pickOffset,
      }),
    [args.rating, args.ownerId, args.currentPuzzleId, halfWindow, pickOffset]
  );
  const { rows, isLoading } = useQuery(query);
  return { rows, isLoading };
}
