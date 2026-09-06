import { sql } from '@pkgs/sql';
import { createQuery, useSyncEngine } from '@pkgs/sync-engine/solid';
import type { Accessor } from 'solid-js';

type PuzzleProfileRatingsRow = {
  readonly rating: number | null;
  readonly rating_deviation: number | null;
};

export function useChessPuzzleProfileRatings(myId: Accessor<string>) {
  const { paintReady } = useSyncEngine();
  const { rows } = createQuery(() =>
    paintReady() && myId().length > 0
      ? sql<PuzzleProfileRatingsRow>`
          SELECT rating, rating_deviation
          FROM chess_puzzle_profiles
          WHERE id = ${myId()}
        `
      : sql<PuzzleProfileRatingsRow>`
          SELECT
            CAST(NULL AS REAL) AS rating,
            CAST(NULL AS REAL) AS rating_deviation
          WHERE false
        `
  );
  return {
    get profileRating() {
      return paintReady() ? (rows()[0]?.rating ?? 0) : 0;
    },
    get profileRd() {
      return paintReady() ? (rows()[0]?.rating_deviation ?? 0) : 0;
    },
  };
}
