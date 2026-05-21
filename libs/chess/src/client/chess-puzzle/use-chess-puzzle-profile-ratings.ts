import { useEntityAttribute } from '@pkgs/patch-db/react';

import {
  CHESS_PUZZLE_PROFILE_ENTITY_TYPE,
  ChessPuzzleProfileAttr,
} from '../../shared/chess-puzzle-profile-entities';

export function useChessPuzzleProfileRatings(myId: string): {
  profileRating: number;
  profileRd: number;
} {
  const profileRating = useEntityAttribute(
    CHESS_PUZZLE_PROFILE_ENTITY_TYPE,
    myId,
    ChessPuzzleProfileAttr.rating
  );
  const profileRd = useEntityAttribute(
    CHESS_PUZZLE_PROFILE_ENTITY_TYPE,
    myId,
    ChessPuzzleProfileAttr.ratingDev
  );
  return { profileRating, profileRd };
}
