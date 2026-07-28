import { useWatchOne } from '@pkgs/sync-engine/client/sync-engine-context';
import { sql, ident } from '@pkgs/sql';

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
    SELECT ${ident(ChessPuzzleProfileCol.rating)} AS rating,
            ${ident(ChessPuzzleProfileCol.ratingDeviation)} AS rating_deviation
     FROM ${ident(CHESS_PUZZLE_PROFILES_TABLE.tableName)}
     WHERE ${ident(ChessPuzzleProfileCol.id)} = ${myId}
  `);
  return {
    profileRating: row?.rating ?? 0,
    profileRd: row?.rating_deviation ?? 0,
  };
}
