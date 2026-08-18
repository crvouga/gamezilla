import { useMyId } from '@libs/auth/client/use-current-user';
import { sql } from '@pkgs/sql';

import { useQuery } from '@pkgs/sync-engine/client';
import { useMemo } from 'react';

import {
  type ChessPuzzleFeedHistoryFilter,
  resolveEffectivePuzzleRating,
} from '../../shared/chess-puzzle-feed-config';
import {
  capPuzzleCandidateOffset,
  hashSeed,
  PUZZLE_CANDIDATE_MAX_OFFSET,
  PUZZLE_NEXT_MAX_BAND,
  type PuzzleCandidateRow,
  pickPuzzleIdFromPool,
} from './next-puzzle-id-helpers';
import { useChessPuzzleFeedConfig } from './use-chess-puzzle-feed-config';
import { usePuzzleCandidatesQuery } from './use-puzzle-candidates-query';

const DEFAULT_RATING = 1200;
const PREFERRED_BAND = 50;

type CandidateQueryResult = {
  readonly rows: readonly PuzzleCandidateRow[];
  readonly isLoading: boolean;
};

function computeNextPuzzleLoading(args: {
  myId: string;
  banded: CandidateQueryResult;
  fallback: CandidateQueryResult;
}): boolean {
  const { myId, banded, fallback } = args;
  if (myId.length === 0) return true;
  if (banded.isLoading) return true;
  return banded.rows.length === 0 && fallback.isLoading;
}

function selectPuzzleResult(
  banded: CandidateQueryResult,
  fallback: CandidateQueryResult
): CandidateQueryResult {
  if (banded.rows.length > 0) return banded;
  return fallback;
}

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
  const profileRatingRaw = rows[0]?.value;
  if (typeof profileRatingRaw === 'number' && profileRatingRaw > 0) {
    return profileRatingRaw;
  }
  return DEFAULT_RATING;
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
  banded: CandidateQueryResult;
  fallback: CandidateQueryResult;
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
  const rawOffset = hashSeed(seed) % (PUZZLE_CANDIDATE_MAX_OFFSET + 1);
  // Cap OFFSET in JS so a 50-row fixture cannot skip past the end of the table.
  const pickOffset = capPuzzleCandidateOffset(rawOffset, localPuzzleTotal);
  const { banded, fallback } = usePuzzleCandidateQueries({
    rating,
    myId,
    currentPuzzleId,
    pickOffset,
    historyFilter: config.historyFilter,
    themes: config.themes,
  });
  const puzzleResult = selectPuzzleResult(banded, fallback);
  const puzzleId = useMemo(
    () =>
      pickPuzzleIdFromPool({
        rows: puzzleResult.rows,
        rating,
        preferredBand: PREFERRED_BAND,
        seed,
      }),
    [puzzleResult.rows, rating, seed]
  );
  const noCandidates = banded.rows.length === 0 && fallback.rows.length === 0;
  const waitingForLocalPuzzles =
    myId.length > 0 &&
    puzzleId === null &&
    localPuzzleTotal === 0 &&
    noCandidates;
  const loading =
    computeNextPuzzleLoading({ myId, banded, fallback }) ||
    waitingForLocalPuzzles;

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

export { PUZZLE_NEXT_MAX_BAND } from './next-puzzle-id-helpers';
