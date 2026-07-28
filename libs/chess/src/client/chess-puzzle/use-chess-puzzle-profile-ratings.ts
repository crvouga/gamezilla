import { useWatchOne } from '@pkgs/sync-engine/client/sync-engine-context';
import { raw, sql } from '@pkgs/sql';

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
  const { row } = useWatchOne<PuzzleProfileRatingsRow>(sql`
    SELECT ${raw(ChessPuzzleProfileCol.rating)} AS rating,
            ${raw(ChessPuzzleProfileCol.ratingDeviation)} AS rating_deviation
     FROM ${raw(CHESS_PUZZLE_PROFILES_TABLE.tableName)}
     WHERE ${raw(ChessPuzzleProfileCol.id)} = ${myId}
  `);
  return {
    profileRating: row?.rating ?? 0,
    profileRd: row?.rating_deviation ?? 0,
  };
}
