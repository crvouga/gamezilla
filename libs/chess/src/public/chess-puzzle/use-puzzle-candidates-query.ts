import { createQuery } from '@pkgs/sync-engine/solid';
import {
  buildPuzzleCandidatesSql,
  PUZZLE_NEXT_MAX_BAND,
} from '../../shared/puzzle-session/next-puzzle-selection';
import type { ChessPuzzleFeedHistoryFilter } from '../chess-puzzle-feed-config';

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
  const query = createQuery(() =>
    buildPuzzleCandidatesSql({
      rating: args.rating,
      // null is the unbounded fallback, not the default band.
      halfWindow:
        args.halfWindow === undefined ? PUZZLE_NEXT_MAX_BAND : args.halfWindow,
      ownerId: args.ownerId,
      historyFilter: args.historyFilter,
      themes: args.themes,
      currentPuzzleId: args.currentPuzzleId,
      pickOffset: args.pickOffset ?? 0,
    })
  );
  return {
    get rows() {
      return query.rows();
    },
    get isLoading() {
      return query.isLoading();
    },
  };
}
