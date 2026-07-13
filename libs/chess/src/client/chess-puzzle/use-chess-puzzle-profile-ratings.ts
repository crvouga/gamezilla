import { useWatchOne } from '@pkgs/sync-engine/client/sync-engine-context';

import {
  CHESS_PUZZLE_PROFILES_TABLE,
  ChessPuzzleProfileCol,
} from '@libs/db/shared/chess-tables';

type PuzzleProfileRatingsRow = {
  readonly rating: number | null;
  readonly rating_deviation: number | null;
};

export function useChessPuzzleProfileRatings(myId: string): {
  profileRating: number;
  profileRd: number;
} {
  const { row } = useWatchOne<PuzzleProfileRatingsRow>(
    `SELECT ${ChessPuzzleProfileCol.rating} AS rating,
            ${ChessPuzzleProfileCol.ratingDeviation} AS rating_deviation
     FROM ${CHESS_PUZZLE_PROFILES_TABLE.tableName}
     WHERE ${ChessPuzzleProfileCol.id} = ?`,
    [myId]
  );
  return {
    profileRating: row?.rating ?? 0,
    profileRd: row?.rating_deviation ?? 0,
  };
}
