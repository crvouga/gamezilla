import { useQuery } from '@pkgs/sync-engine/client';
import { useMemo } from 'react';

import type { ChessPuzzleFeedHistoryFilter } from '../../shared/chess-puzzle-feed-config';
import {
  buildPuzzleCandidatesSql,
  PUZZLE_NEXT_MAX_BAND,
} from './next-puzzle-id-helpers';

export type PuzzleCandidatesQueryArgs = {
  readonly rating: number;
  readonly ownerId: string;
  readonly currentPuzzleId: string | null;
  readonly historyFilter: ChessPuzzleFeedHistoryFilter;
  readonly themes: readonly string[];
  readonly halfWindow?: number | null;
  readonly pickOffset?: number;
};

export function usePuzzleCandidatesQuery(args: PuzzleCandidatesQueryArgs) {
  // `null` means unbounded (fallback). Only omit → default band.
  // `??` would wrongly treat null as default and empty the pool at high ratings.
  const halfWindow =
    args.halfWindow === undefined ? PUZZLE_NEXT_MAX_BAND : args.halfWindow;
  const pickOffset = args.pickOffset ?? 0;
  const themesKey = args.themes.join('\u0000');
  const themes = useMemo(
    () => (themesKey.length === 0 ? [] : themesKey.split('\u0000')),
    [themesKey]
  );
  const query = useMemo(
    () =>
      buildPuzzleCandidatesSql({
        rating: args.rating,
        halfWindow,
        ownerId: args.ownerId,
        historyFilter: args.historyFilter,
        themes,
        currentPuzzleId: args.currentPuzzleId,
        pickOffset,
      }),
    [
      args.rating,
      args.ownerId,
      args.historyFilter,
      themes,
      args.currentPuzzleId,
      halfWindow,
      pickOffset,
    ]
  );
  const { rows, isLoading } = useQuery(query);
  return { rows, isLoading };
}
