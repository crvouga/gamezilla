import { useWatchValue } from '@pkgs/sync-engine/client/sync-engine-context';

import {
  CHESS_PUZZLE_PROFILES_TABLE,
  ChessPuzzleProfileCol,
} from '@libs/db/shared/chess-tables';

export function useChessPuzzleProfileRatings(myId: string): {
  profileRating: number;
  profileRd: number;
} {
  const { value: profileRating } = useWatchValue<number>(
    `SELECT ${ChessPuzzleProfileCol.rating} AS value
     FROM ${CHESS_PUZZLE_PROFILES_TABLE.tableName}
     WHERE ${ChessPuzzleProfileCol.id} = ?`,
    [myId]
  );
  const { value: profileRd } = useWatchValue<number>(
    `SELECT ${ChessPuzzleProfileCol.ratingDeviation} AS value
     FROM ${CHESS_PUZZLE_PROFILES_TABLE.tableName}
     WHERE ${ChessPuzzleProfileCol.id} = ?`,
    [myId]
  );
  return {
    profileRating: profileRating ?? 0,
    profileRd: profileRd ?? 0,
  };
}
