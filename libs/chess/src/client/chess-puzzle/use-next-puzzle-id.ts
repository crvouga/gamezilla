import { useMyId } from '@libs/auth/client/use-current-user';
import {
  useWatchValue,
} from '@pkgs/sync-engine/client/sync-engine-context';
import { useMemo } from 'react';

import {
  CHESS_PUZZLE_PROFILES_TABLE,
  ChessPuzzleProfileCol,
} from '../../shared/sync-tables';
import {
  hashSeed,
  pickPuzzleIdFromPool,
  PUZZLE_CANDIDATE_MAX_OFFSET,
  PUZZLE_NEXT_MAX_BAND,
} from './next-puzzle-id-helpers';
import { usePuzzleCandidatesQuery } from './use-puzzle-candidates-query';
import { CHESS_PUZZLES_TABLE } from '../../shared/sync-tables';

const DEFAULT_RATING = 1200;
const PREFERRED_BAND = 50;

function computeNextPuzzleLoading(args: {
  myId: string;
  banded: { rows: readonly unknown[]; isLoading: boolean };
  fallback: { rows: readonly unknown[]; isLoading: boolean };
  replay: { isLoading: boolean };
}): boolean {
  const { myId, banded, fallback, replay } = args;
  if (myId.length === 0) return true;
  if (banded.isLoading) return true;
  if (banded.rows.length === 0 && fallback.isLoading) return true;
  return (
    banded.rows.length === 0 &&
    fallback.rows.length === 0 &&
    replay.isLoading
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

  const { value: profileRatingRaw } = useWatchValue<number>(
    `SELECT ${ChessPuzzleProfileCol.rating} AS value
     FROM ${CHESS_PUZZLE_PROFILES_TABLE.tableName}
     WHERE ${ChessPuzzleProfileCol.id} = ?`,
    [myId]
  );
  const rating =
    typeof profileRatingRaw === 'number' && profileRatingRaw > 0
      ? profileRatingRaw
      : DEFAULT_RATING;

  const pickOffset = hashSeed(seed) % (PUZZLE_CANDIDATE_MAX_OFFSET + 1);

  const bandedResult = usePuzzleCandidatesQuery(
    rating,
    myId,
    currentPuzzleId,
    PUZZLE_NEXT_MAX_BAND,
    pickOffset
  );
  const fallbackResult = usePuzzleCandidatesQuery(
    rating,
    myId,
    currentPuzzleId,
    null,
    pickOffset
  );
  const replayResult = usePuzzleCandidatesQuery(
    rating,
    '',
    currentPuzzleId,
    null,
    pickOffset
  );
  const puzzleResult =
    bandedResult.rows.length > 0 ? bandedResult : fallbackResult.rows.length > 0 ? fallbackResult : replayResult;

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

  const loading = computeNextPuzzleLoading({
    myId,
    banded: bandedResult,
    fallback: fallbackResult,
    replay: replayResult,
  });

  const { value: localPuzzleTotal } = useWatchValue<number>(
    `SELECT count(*) AS value FROM ${CHESS_PUZZLES_TABLE.tableName}`,
    []
  );
  const noCandidates =
    bandedResult.rows.length === 0 &&
    fallbackResult.rows.length === 0 &&
    replayResult.rows.length === 0;

  const waitingForLocalPuzzles =
    myId.length > 0 &&
    puzzleId === null &&
    (localPuzzleTotal ?? 0) === 0 &&
    noCandidates;

  return {
    puzzleId,
    rating,
    loading: loading || waitingForLocalPuzzles,
    bandedCount: bandedResult.rows.length,
    fallbackCount: fallbackResult.rows.length,
    replayCount: replayResult.rows.length,
  };
}

export { PUZZLE_NEXT_MAX_BAND } from './next-puzzle-id-helpers';
