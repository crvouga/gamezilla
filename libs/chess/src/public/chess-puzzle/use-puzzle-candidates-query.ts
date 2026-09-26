import { createQuery } from '@pkgs/sync-engine/solid';
import type { Accessor } from 'solid-js';

import {
  buildExhaustedPuzzleCandidatesSql,
  buildPuzzleCandidatesSql,
  type PuzzleCandidateRow,
  type PuzzleExhaustedCandidateRow,
} from '../../shared/puzzle-session/next-puzzle-selection';
import type { ChessPuzzleFeedHistoryFilter } from '../chess-puzzle-feed-config';

export type PuzzleCandidatesQueryArgs = {
  readonly rating: Accessor<number>;
  readonly ownerId: Accessor<string>;
  readonly currentPuzzleId: Accessor<string | null>;
  readonly historyFilter: Accessor<ChessPuzzleFeedHistoryFilter>;
  readonly themes: Accessor<readonly string[]>;
  /** §9 half-window around the rating; null reads the whole catalog. */
  readonly halfWindow: Accessor<number | null>;
  readonly pickOffset?: Accessor<number>;
};

export function usePuzzleCandidatesQuery(args: PuzzleCandidatesQueryArgs): {
  readonly rows: Accessor<readonly PuzzleCandidateRow[]>;
  readonly isLoading: Accessor<boolean>;
} {
  const query = createQuery(() =>
    buildPuzzleCandidatesSql({
      rating: args.rating(),
      halfWindow: args.halfWindow(),
      ownerId: args.ownerId(),
      historyFilter: args.historyFilter(),
      themes: args.themes(),
      currentPuzzleId: args.currentPuzzleId(),
      pickOffset: args.pickOffset?.() ?? 0,
    })
  );
  return {
    rows: query.rows,
    isLoading: query.isLoading,
  };
}

/** §9 exhausted pool: already-attempted puzzles, oldest attempt first. */
export function useExhaustedPuzzleCandidatesQuery(args: {
  readonly ownerId: Accessor<string>;
  readonly themes: Accessor<readonly string[]>;
  readonly currentPuzzleId: Accessor<string | null>;
  /** Off unless the feed is hiding played puzzles (the default). */
  readonly enabled: Accessor<boolean>;
}): {
  readonly rows: Accessor<readonly PuzzleExhaustedCandidateRow[]>;
  readonly isLoading: Accessor<boolean>;
} {
  const query = createQuery(() =>
    buildExhaustedPuzzleCandidatesSql({
      ownerId: args.enabled() ? args.ownerId() : '',
      themes: args.themes(),
      currentPuzzleId: args.currentPuzzleId(),
    })
  );
  return {
    rows: () => (args.enabled() ? query.rows() : []),
    isLoading: query.isLoading,
  };
}
