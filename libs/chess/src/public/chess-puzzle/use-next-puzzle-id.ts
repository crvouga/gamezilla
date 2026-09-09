import { useMyId } from '@libs/auth/public/use-current-user';
import { sql } from '@pkgs/sql';
import { createQuery } from '@pkgs/sync-engine/solid';
import { type Accessor, createMemo } from 'solid-js';

import {
  computeNextPuzzleLoading,
  PUZZLE_NEXT_MAX_BAND,
  PUZZLE_PREFERRED_BAND,
  pickPuzzleIdFromPool,
  resolveProfilePuzzleRating,
  resolvePuzzlePickOffset,
  selectPuzzleCandidates,
} from '../../shared/puzzle-session/next-puzzle-selection';
import {
  type ChessPuzzleFeedHistoryFilter,
  resolveEffectivePuzzleRating,
} from '../chess-puzzle-feed-config';
import { useChessPuzzleFeedConfig } from './use-chess-puzzle-feed-config';
import { usePuzzleCandidatesQuery } from './use-puzzle-candidates-query';

type PuzzleRatingValueRow = { readonly value: number };

function usePuzzleProfileRating(): Accessor<number> {
  const myId = useMyId();
  const query = createMemo(
    () => sql<PuzzleRatingValueRow>`
      SELECT rating AS value
      FROM chess_puzzle_profiles
      WHERE id = ${myId()}
    `
  );
  const { rows } = createQuery(query);
  return createMemo(() => resolveProfilePuzzleRating(rows()[0]?.value));
}

function useEffectivePuzzleRating(): Accessor<number> {
  const [config] = useChessPuzzleFeedConfig();
  const profileRating = usePuzzleProfileRating();
  return createMemo(() =>
    resolveEffectivePuzzleRating({
      config: config(),
      profileRating: profileRating(),
    })
  );
}

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

type PuzzleCountRow = { readonly value: number };

function useLocalPuzzleTotal(): Accessor<number> {
  const { rows } = createQuery(
    () => sql<PuzzleCountRow>`
      SELECT COUNT(*) AS value
      FROM chess_puzzles
    `
  );
  return createMemo(() => Number(rows()[0]?.value ?? 0));
}

export function useNextPuzzleId(args: {
  currentPuzzleId: Accessor<string | null>;
  seed: Accessor<string>;
}): {
  puzzleId: Accessor<string | null>;
  rating: Accessor<number>;
  loading: Accessor<boolean>;
  bandedCount: Accessor<number>;
  fallbackCount: Accessor<number>;
  replayCount: number;
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
  const puzzleResult = selectPuzzleCandidates(banded, fallback);
  const puzzleId = createMemo(() =>
    pickPuzzleIdFromPool({
      rows: puzzleResult.rows,
      rating: rating(),
      preferredBand: PUZZLE_PREFERRED_BAND,
      seed: args.seed(),
    })
  );
  const loading = createMemo(() =>
    computeNextPuzzleLoading({
      myId: myId(),
      banded,
      fallback,
      puzzleId: puzzleId(),
      localPuzzleTotal: localPuzzleTotal(),
    })
  );

  return {
    puzzleId,
    rating,
    loading,
    bandedCount: () => banded.rows.length,
    fallbackCount: () => fallback.rows.length,
    replayCount: 0,
  };
}

export { PUZZLE_NEXT_MAX_BAND } from '../../shared/puzzle-session/next-puzzle-selection';
