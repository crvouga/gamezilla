import { useMyId } from '@libs/auth/public/use-current-user';
import { createQuery } from '@pkgs/sync-engine/solid';
import { type Accessor, createMemo } from 'solid-js';

import {
  buildPuzzleTotalCountSql,
  computeNextPuzzleLoading,
  PUZZLE_NEXT_MAX_BAND,
  PUZZLE_PREFERRED_BAND,
  pickPuzzleIdFromPool,
  resolvePuzzlePickOffset,
  selectPuzzleCandidates,
} from '../../shared/puzzle-session/next-puzzle-selection';
import type { ChessPuzzleFeedHistoryFilter } from '../chess-puzzle-feed-config';
import { useChessPuzzleFeedConfig } from './use-chess-puzzle-feed-config';
import { useEffectivePuzzleRating } from './use-effective-puzzle-rating';
import { usePuzzleCandidatesQuery } from './use-puzzle-candidates-query';

function usePuzzleCandidateQueries(args: {
  rating: Accessor<number>;
  myId: Accessor<string>;
  currentPuzzleId: Accessor<string | null>;
  pickOffset: Accessor<number>;
  historyFilter: Accessor<ChessPuzzleFeedHistoryFilter>;
  themes: Accessor<readonly string[]>;
}) {
  const banded = usePuzzleCandidatesQuery({
    rating: args.rating,
    ownerId: args.myId,
    currentPuzzleId: args.currentPuzzleId,
    historyFilter: args.historyFilter,
    themes: args.themes,
    halfWindow: PUZZLE_NEXT_MAX_BAND,
    pickOffset: args.pickOffset,
  });
  const fallback = usePuzzleCandidatesQuery({
    rating: args.rating,
    ownerId: args.myId,
    currentPuzzleId: args.currentPuzzleId,
    historyFilter: args.historyFilter,
    themes: args.themes,
    halfWindow: null,
    pickOffset: args.pickOffset,
  });
  return { banded, fallback };
}

function useLocalPuzzleTotal(): Accessor<number> {
  const { rows } = createQuery(buildPuzzleTotalCountSql);
  return createMemo(() => Number(rows()[0]?.value ?? 0));
}

export function useNextPuzzleId(args: {
  currentPuzzleId: Accessor<string | null>;
  seed: Accessor<string>;
  poolReady: Accessor<boolean>;
}): {
  puzzleId: Accessor<string | null>;
  rating: Accessor<number>;
  loading: Accessor<boolean>;
  bandedCount: Accessor<number>;
  fallbackCount: Accessor<number>;
  localPuzzleTotal: Accessor<number>;
} {
  const myId = useMyId();
  const [config] = useChessPuzzleFeedConfig();
  const rating = useEffectivePuzzleRating();
  const localPuzzleTotal = useLocalPuzzleTotal();
  const pickOffset = createMemo(() =>
    resolvePuzzlePickOffset(args.seed(), localPuzzleTotal())
  );
  const { banded, fallback } = usePuzzleCandidateQueries({
    rating,
    myId,
    currentPuzzleId: args.currentPuzzleId,
    pickOffset,
    historyFilter: () => config().historyFilter,
    themes: () => config().themes,
  });
  const puzzleResult = createMemo(() =>
    selectPuzzleCandidates(
      { rows: banded.rows(), isLoading: banded.isLoading() },
      { rows: fallback.rows(), isLoading: fallback.isLoading() }
    )
  );
  const puzzleId = createMemo(() =>
    pickPuzzleIdFromPool({
      rows: puzzleResult().rows,
      rating: rating(),
      preferredBand: PUZZLE_PREFERRED_BAND,
      seed: args.seed(),
    })
  );
  const loading = createMemo(() =>
    computeNextPuzzleLoading({
      myId: myId(),
      banded: { rows: banded.rows(), isLoading: banded.isLoading() },
      fallback: { rows: fallback.rows(), isLoading: fallback.isLoading() },
      puzzleId: puzzleId(),
      localPuzzleTotal: localPuzzleTotal(),
      poolReady: args.poolReady(),
    })
  );

  return {
    puzzleId,
    rating,
    loading,
    bandedCount: () => banded.rows().length,
    fallbackCount: () => fallback.rows().length,
    localPuzzleTotal,
  };
}

export { PUZZLE_NEXT_MAX_BAND } from '../../shared/puzzle-session/next-puzzle-selection';
