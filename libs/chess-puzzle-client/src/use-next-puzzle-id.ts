import { useMyId } from '@libs/auth-client/use-current-user';
import type { PuzzleFeedHistoryFilter } from '@libs/game-puzzle-shared/feed-config';
import type { PuzzlePickSource } from '@libs/game-puzzle-shared/next-puzzle-selection';

import {
  buildPuzzleBandCountSql,
  computeNextPuzzleLoading,
  PUZZLE_NEXT_MAX_BAND,
  pickNextPuzzle,
  puzzleSelectionHalfWindow,
  resolvePuzzlePickOffset,
} from '@libs/game-puzzle-shared/next-puzzle-selection';
import {
  createQuery,
  useSyncEngine,
} from '@pkgs/sync-engine-client/sync-engine-context';
import { type Accessor, createMemo } from 'solid-js';
import { useChessPuzzleFeedConfig } from './use-chess-puzzle-feed-config';
import { useChessPuzzleProfileRatings } from './use-chess-puzzle-profile-ratings';
import { useEffectivePuzzleRating } from './use-effective-puzzle-rating';
import {
  useExhaustedPuzzleCandidatesQuery,
  usePuzzleCandidatesQuery,
} from './use-puzzle-candidates-query';

function usePuzzleCandidateQueries(args: {
  rating: Accessor<number>;
  myId: Accessor<string>;
  currentPuzzleId: Accessor<string | null>;
  pickOffset: Accessor<number>;
  historyFilter: Accessor<PuzzleFeedHistoryFilter>;
  themes: Accessor<readonly string[]>;
  halfWindow: Accessor<number>;
}) {
  const banded = usePuzzleCandidatesQuery({
    rating: args.rating,
    ownerId: args.myId,
    currentPuzzleId: args.currentPuzzleId,
    historyFilter: args.historyFilter,
    themes: args.themes,
    halfWindow: args.halfWindow,
    pickOffset: args.pickOffset,
  });
  const fallback = usePuzzleCandidatesQuery({
    rating: args.rating,
    ownerId: args.myId,
    currentPuzzleId: args.currentPuzzleId,
    historyFilter: args.historyFilter,
    themes: args.themes,
    halfWindow: () => null,
    pickOffset: args.pickOffset,
  });
  const exhausted = useExhaustedPuzzleCandidatesQuery({
    ownerId: args.myId,
    themes: args.themes,
    currentPuzzleId: args.currentPuzzleId,
    // Only the "hide played puzzles" feed over every theme comes round to
    // played puzzles; every other history filter serves attempted puzzles
    // on its own terms, and a chosen theme with nothing unplayed left is an
    // empty feed until played puzzles are included.
    enabled: () =>
      args.historyFilter() === 'neverSeen' && args.themes().length === 0,
  });
  return { banded, fallback, exhausted };
}

/** Local rows in the active rating window (not the whole catalog). */
function useLocalPuzzleTotal(rating: Accessor<number>): Accessor<number> {
  const { rows } = createQuery(() =>
    buildPuzzleBandCountSql({
      rating: rating(),
      halfWindow: PUZZLE_NEXT_MAX_BAND,
    })
  );
  return createMemo(() => Number(rows()[0]?.value ?? 0));
}

export function useNextPuzzleId(args: {
  currentPuzzleId: Accessor<string | null>;
  seed: Accessor<string>;
  poolReady: Accessor<boolean>;
}): {
  puzzleId: Accessor<string | null>;
  rating: Accessor<number>;
  /** §9 half-window the pick used (widens with the player's RD). */
  halfWindow: Accessor<number>;
  source: Accessor<PuzzlePickSource | null>;
  loading: Accessor<boolean>;
  bandedCount: Accessor<number>;
  fallbackCount: Accessor<number>;
  localPuzzleTotal: Accessor<number>;
} {
  const myId = useMyId();
  const { status } = useSyncEngine();
  const [config] = useChessPuzzleFeedConfig();
  const rating = useEffectivePuzzleRating();
  const { profileRd } = useChessPuzzleProfileRatings(myId);
  const halfWindow = createMemo(() => puzzleSelectionHalfWindow(profileRd()));
  const localPuzzleTotal = useLocalPuzzleTotal(rating);
  const pickOffset = createMemo(() =>
    resolvePuzzlePickOffset(args.seed(), localPuzzleTotal())
  );
  const { banded, fallback, exhausted } = usePuzzleCandidateQueries({
    rating,
    myId,
    currentPuzzleId: args.currentPuzzleId,
    pickOffset,
    historyFilter: () => config().historyFilter,
    themes: () => config().themes,
    halfWindow,
  });
  const pick = createMemo(() =>
    pickNextPuzzle({
      banded: { rows: banded.rows(), isLoading: banded.isLoading() },
      fallback: { rows: fallback.rows(), isLoading: fallback.isLoading() },
      exhausted: exhausted.rows(),
      rating: rating(),
      seed: args.seed(),
    })
  );
  const puzzleId = createMemo(() => pick().puzzleId);
  const loading = createMemo(() =>
    computeNextPuzzleLoading({
      myId: myId(),
      banded: { rows: banded.rows(), isLoading: banded.isLoading() },
      fallback: { rows: fallback.rows(), isLoading: fallback.isLoading() },
      exhausted: {
        rows: exhausted.rows(),
        isLoading: exhausted.isLoading(),
      },
      puzzleId: puzzleId(),
      localPuzzleTotal: localPuzzleTotal(),
      poolReady: args.poolReady(),
      online: status().online,
    })
  );

  return {
    puzzleId,
    rating,
    halfWindow,
    source: createMemo(() => pick().source),
    loading,
    bandedCount: () => banded.rows().length,
    fallbackCount: () => fallback.rows().length,
    localPuzzleTotal,
  };
}
