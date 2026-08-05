import { sql } from '@pkgs/sql';

import { useWatchOne } from '@pkgs/sync-engine/client/sync-engine-context';
import { useSyncEnginePaintReady } from '@pkgs/sync-engine/client/sync-engine-paint-gate';
import { useMemo } from 'react';

type PuzzleProfileRatingsRow = {
  readonly rating: number | null;
  readonly rating_deviation: number | null;
};

export function useChessPuzzleProfileRatings(myId: string): {
  profileRating: number;
  profileRd: number;
} {
  const paintReady = useSyncEnginePaintReady();
  const enabled = paintReady && myId.length > 0;
  const query = useMemo(
    () =>
      enabled
        ? sql<PuzzleProfileRatingsRow>`
            SELECT rating, rating_deviation
            FROM chess_puzzle_profiles
            WHERE id = ${myId}
          `
        : sql<PuzzleProfileRatingsRow>`
            SELECT
              CAST(NULL AS REAL) AS rating,
              CAST(NULL AS REAL) AS rating_deviation
            WHERE false
          `,
    [enabled, myId]
  );
  const { row } = useWatchOne(query);
  if (!paintReady) {
    return { profileRating: 0, profileRd: 0 };
  }
  return {
    profileRating: row?.rating ?? 0,
    profileRd: row?.rating_deviation ?? 0,
  };
}
