import { useMyId } from '@libs/auth/public/use-current-user';
import { sql } from '@pkgs/sql';

import { useQuery } from '@pkgs/sync-engine/client';
import { useMemo } from 'react';
import {
  computeNextPuzzleLoading,
  PUZZLE_NEXT_MAX_BAND,
  PUZZLE_PREFERRED_BAND,
  type PuzzleCandidateQueryResult,
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

function usePuzzleProfileRating(): number {
  const myId = useMyId();
  const query = useMemo(
    () => sql<PuzzleRatingValueRow>`
      SELECT rating AS value
      FROM chess_puzzle_profiles
      WHERE id = ${myId}
    `,
    [myId]
  );
  const { rows } = useQuery(query);
  return resolveProfilePuzzleRating(rows[0]?.value);
}

function useEffectivePuzzleRating(): number {
  const [config] = useChessPuzzleFeedConfig();
  const profileRating = usePuzzleProfileRating();
  return useMemo(
    () => resolveEffectivePuzzleRating({ config, profileRating }),
    [config, profileRating]
  );
}

function usePuzzleCandidateQueries(args: {
  rating: number;
  myId: string;
  currentPuzzleId: string | null;
  pickOffset: number;
  historyFilter: ChessPuzzleFeedHistoryFilter;
  themes: readonly string[];
}): {
  banded: PuzzleCandidateQueryResult;
  fallback: PuzzleCandidateQueryResult;
} {
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

function useLocalPuzzleTotal(): number {
  const { rows } = useQuery(sql<PuzzleCountRow>`
    SELECT COUNT(*) AS value
    FROM chess_puzzles
  `);
  return Number(rows[0]?.value ?? 0);
}

export function useNextPuzzleId(args: {
  currentPuzzleId: string | null;
  seed: string;
}): {
  puzzleId: string | null;
  rating: number;
  loading: boolean;
  bandedCount: number;
  fallbackCount: number;
  replayCount: number;
} {
  const { currentPuzzleId, seed } = args;
  const myId = useMyId();
  const [config] = useChessPuzzleFeedConfig();
  const rating = useEffectivePuzzleRating();
  const localPuzzleTotal = useLocalPuzzleTotal();
  // Cap OFFSET in JS so a 50-row fixture cannot skip past the end of the table.
  const pickOffset = resolvePuzzlePickOffset(seed, localPuzzleTotal);
  const { banded, fallback } = usePuzzleCandidateQueries({
    rating,
    myId,
    currentPuzzleId,
    pickOffset,
    historyFilter: config.historyFilter,
    themes: config.themes,
  });
  const puzzleResult = selectPuzzleCandidates(banded, fallback);
  const puzzleId = useMemo(
    () =>
      pickPuzzleIdFromPool({
        rows: puzzleResult.rows,
        rating,
        preferredBand: PUZZLE_PREFERRED_BAND,
        seed,
      }),
    [puzzleResult.rows, rating, seed]
  );
  const loading = computeNextPuzzleLoading({
    myId,
    banded,
    fallback,
    puzzleId,
    localPuzzleTotal,
  });

  return {
    puzzleId,
    rating,
    loading,
    bandedCount: banded.rows.length,
    fallbackCount: fallback.rows.length,
    // Legacy field: replay path removed; filters always apply.
    replayCount: 0,
  };
}

export { PUZZLE_NEXT_MAX_BAND } from '../../shared/puzzle-session/next-puzzle-selection';
