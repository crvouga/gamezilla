import { useMyId } from '@libs/auth/client/use-current-user';
import { sql } from '@pkgs/sql';

import { useQueryValue } from '@pkgs/sync-engine/client/sync-engine-context';
import { useMemo } from 'react';

import { resolveEffectivePuzzleRating } from '../../shared/chess-puzzle-feed-config';
import {
  hashSeed,
  pickPuzzleIdFromPool,
  PUZZLE_CANDIDATE_MAX_OFFSET,
  PUZZLE_NEXT_MAX_BAND,
  type PuzzleCandidateRow,
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
  replay: CandidateQueryResult;
}): boolean {
  const { myId, banded, fallback, replay } = args;
  if (myId.length === 0) return true;
  if (banded.isLoading) return true;
  if (banded.rows.length === 0 && fallback.isLoading) return true;
  return (
    banded.rows.length === 0 && fallback.rows.length === 0 && replay.isLoading
  );
}

function selectPuzzleResult(
  banded: CandidateQueryResult,
  fallback: CandidateQueryResult,
  replay: CandidateQueryResult
): CandidateQueryResult {
  if (banded.rows.length > 0) return banded;
  if (fallback.rows.length > 0) return fallback;
  return replay;
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
  const { value: profileRatingRaw } = useQueryValue(query);
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
}): {
  banded: CandidateQueryResult;
  fallback: CandidateQueryResult;
  replay: CandidateQueryResult;
} {
  const banded = usePuzzleCandidatesQuery({
    rating: args.rating,
    ownerId: args.myId,
    currentPuzzleId: args.currentPuzzleId,
    halfWindow: PUZZLE_NEXT_MAX_BAND,
    pickOffset: args.pickOffset,
  });
  const fallback = usePuzzleCandidatesQuery({
    rating: args.rating,
    ownerId: args.myId,
    currentPuzzleId: args.currentPuzzleId,
    halfWindow: null,
    pickOffset: args.pickOffset,
  });
  const replay = usePuzzleCandidatesQuery({
    rating: args.rating,
    ownerId: '',
    currentPuzzleId: args.currentPuzzleId,
    halfWindow: null,
    pickOffset: args.pickOffset,
  });
  return { banded, fallback, replay };
}

type PuzzleCountRow = { readonly value: number };

function useWaitingForLocalPuzzles(args: {
  myId: string;
  puzzleId: string | null;
  noCandidates: boolean;
}): boolean {
  const { value: localPuzzleTotal } = useQueryValue(sql<PuzzleCountRow>`
    SELECT COUNT(*) AS value
    FROM chess_puzzles
  `);
  return (
    args.myId.length > 0 &&
    args.puzzleId === null &&
    (localPuzzleTotal ?? 0) === 0 &&
    args.noCandidates
  );
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
  const rating = useEffectivePuzzleRating();
  const pickOffset = hashSeed(seed) % (PUZZLE_CANDIDATE_MAX_OFFSET + 1);
  const { banded, fallback, replay } = usePuzzleCandidateQueries({
    rating,
    myId,
    currentPuzzleId,
    pickOffset,
  });
  const puzzleResult = selectPuzzleResult(banded, fallback, replay);
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
  const noCandidates =
    banded.rows.length === 0 &&
    fallback.rows.length === 0 &&
    replay.rows.length === 0;
  const waitingForLocalPuzzles = useWaitingForLocalPuzzles({
    myId,
    puzzleId,
    noCandidates,
  });
  const loading =
    computeNextPuzzleLoading({ myId, banded, fallback, replay }) ||
    waitingForLocalPuzzles;

  return {
    puzzleId,
    rating,
    loading,
    bandedCount: banded.rows.length,
    fallbackCount: fallback.rows.length,
    replayCount: replay.rows.length,
  };
}

export { PUZZLE_NEXT_MAX_BAND } from './next-puzzle-id-helpers';
