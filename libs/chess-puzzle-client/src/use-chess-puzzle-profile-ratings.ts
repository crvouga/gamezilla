import sql from '@pkgs/sql-shared/sql';
import { createQuery, useSyncEngine } from '@pkgs/sync-engine-client/sync-engine-context';
import { type Accessor, createMemo } from 'solid-js';

import { isProvisionalPuzzleRating, PUZZLE_RATING_DEFAULT_RD } from '@libs/chess-puzzle-shared/chess-puzzle-rating';

type PuzzleProfileRatingsRow = {
  readonly rating: number | null;
  readonly rating_deviation: number | null;
};

/**
 * The player's §8 rating state from the synced profile row. Before the first
 * rated attempt there is no row: that is the 1500 / RD 350 provisional start.
 */
export function useChessPuzzleProfileRatings(myId: Accessor<string>): {
  readonly profileRating: Accessor<number>;
  readonly profileRd: Accessor<number>;
  readonly provisional: Accessor<boolean>;
} {
  const { paintReady } = useSyncEngine();
  const { rows } = createQuery(() =>
    paintReady() && myId().length > 0
      ? sql<PuzzleProfileRatingsRow>`
          SELECT rating, rating_deviation
          FROM chess_puzzle_profiles
          WHERE id = ${myId()}
            AND deleted_at IS NULL
        `
      : sql<PuzzleProfileRatingsRow>`
          SELECT
            CAST(NULL AS REAL) AS rating,
            CAST(NULL AS REAL) AS rating_deviation
          WHERE false
        `
  );
  const profileRating = createMemo(() =>
    paintReady() ? (rows()[0]?.rating ?? 0) : 0
  );
  const profileRd = createMemo(() => {
    const rd = paintReady() ? (rows()[0]?.rating_deviation ?? 0) : 0;
    return rd > 0 ? rd : PUZZLE_RATING_DEFAULT_RD;
  });
  return {
    profileRating,
    profileRd,
    provisional: createMemo(() => isProvisionalPuzzleRating(profileRd())),
  };
}
