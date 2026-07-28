import { useWatchOne } from '@pkgs/sync-engine/client/sync-engine-context';
import { honey } from '@pkgs/sql';

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
    honey({
      select: [
        [ChessPuzzleProfileCol.rating, 'rating'],
        [ChessPuzzleProfileCol.ratingDeviation, 'rating_deviation'],
      ],
      from: CHESS_PUZZLE_PROFILES_TABLE.tableName,
      where: ['=', ChessPuzzleProfileCol.id, myId],
    })
  );
  return {
    profileRating: row?.rating ?? 0,
    profileRd: row?.rating_deviation ?? 0,
  };
}
