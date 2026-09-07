import { createQuery } from '@pkgs/sync-engine/solid';
import type { Accessor } from 'solid-js';

import {
  buildPuzzleCandidatesSql,
  PUZZLE_NEXT_MAX_BAND,
} from '../../shared/puzzle-session/next-puzzle-selection';
import type { ChessPuzzleFeedHistoryFilter } from '../chess-puzzle-feed-config';

export type PuzzleCandidatesQueryArgs = {
  readonly rating: Accessor<number>;
  readonly ownerId: Accessor<string>;
  readonly currentPuzzleId: string | null;
  readonly historyFilter: Accessor<ChessPuzzleFeedHistoryFilter>;
  readonly themes: Accessor<readonly string[]>;
  readonly halfWindow?: number | null;
  readonly pickOffset?: Accessor<number>;
};

export function usePuzzleCandidatesQuery(args: PuzzleCandidatesQueryArgs) {
  const query = createQuery(() =>
    buildPuzzleCandidatesSql({
      rating: args.rating(),
      halfWindow:
        args.halfWindow === undefined ? PUZZLE_NEXT_MAX_BAND : args.halfWindow,
      ownerId: args.ownerId(),
      historyFilter: args.historyFilter(),
      themes: args.themes(),
      currentPuzzleId: args.currentPuzzleId,
      pickOffset: args.pickOffset?.() ?? 0,
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
