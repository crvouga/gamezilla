import { useQuery } from '@gamezilla/patch-db/react';
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
  excludeIds: readonly string[]
) {
  const puzzleQuery = useMemo(
    () => ({
      entityType: CHESS_PUZZLE_ENTITY_TYPE,
      where: buildPuzzleWhere(rating, PUZZLE_NEXT_MAX_BAND, excludeIds),
      orderBy: [
        {
          attribute: ChessPuzzleAttr.popularity.key,
          direction: 'desc' as const,
        },
      ],
      limit: 50,
    }),
    [rating, excludeIds]
  );
  return useQuery(puzzleQuery);
}
