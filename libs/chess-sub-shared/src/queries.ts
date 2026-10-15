import { chessPuzzleById } from '@libs/chess-puzzle-shared/chess-puzzle-by-id-query';
import { chessPuzzleFeedSettings } from '@libs/chess-puzzle-shared/chess-puzzle-feed-settings-query';
import { chessPuzzleInteractions } from '@libs/chess-puzzle-shared/chess-puzzle-interactions-query';
import {
  chessPuzzleNearest,
  chessPuzzlePool,
} from '@libs/chess-puzzle-shared/chess-puzzle-pool-query';
import { chessPuzzleProfile } from '@libs/chess-puzzle-shared/chess-puzzle-profile-query';
import { chessPuzzleRatingEvents } from '@libs/chess-puzzle-shared/chess-puzzle-rating-events-query';

export const CHESS_QUERIES = [
  chessPuzzleProfile,
  chessPuzzleFeedSettings,
  chessPuzzleInteractions,
  chessPuzzleRatingEvents,
  chessPuzzlePool,
  chessPuzzleNearest,
  chessPuzzleById,
] as const;
