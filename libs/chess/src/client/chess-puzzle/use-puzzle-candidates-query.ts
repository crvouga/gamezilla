import { useQuery } from '@pkgs/patch-db/react';
import { useMemo } from 'react';

import {
  CHESS_PUZZLE_ENTITY_TYPE,
  ChessPuzzleAttr,
} from '../../shared/chess-puzzle-entities';
import {
  buildPuzzleWhere,
  PUZZLE_NEXT_MAX_BAND,
} from './next-puzzle-id-helpers';

export function usePuzzleCandidatesQuery(
  rating: number,
  ownerId: string,
  currentPuzzleId: string | null,
  halfWindow: number | null = PUZZLE_NEXT_MAX_BAND
) {
  const puzzleQuery = useMemo(() => {
    const where = buildPuzzleWhere(
      rating,
      halfWindow,
      ownerId,
      currentPuzzleId
    );
    return {
      entityType: CHESS_PUZZLE_ENTITY_TYPE,
      ...(where !== undefined ? { where } : {}),
      orderBy: [
        {
          attribute: ChessPuzzleAttr.popularity.key,
          direction: 'desc' as const,
        },
      ],
      limit: 50,
    };
  }, [rating, ownerId, currentPuzzleId, halfWindow]);
  return useQuery(puzzleQuery);
}
