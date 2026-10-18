import { chessPuzzleImport } from '@libs/chess-puzzle-shared/puzzle-import-query';
import { chessPuzzleById } from '@libs/game-puzzle-shared/by-id-query';
import { chessPuzzleFeedSettings } from '@libs/game-puzzle-shared/feed-settings-query';
import { chessPuzzleInteractions } from '@libs/game-puzzle-shared/interactions-query';
import {
  chessPuzzleNearest,
  chessPuzzlePool,
} from '@libs/game-puzzle-shared/pool-query';
import { chessPuzzleProfile } from '@libs/game-puzzle-shared/profile-query';
import { chessPuzzleRatingEvents } from '@libs/game-puzzle-shared/rating-events-query';

export const CHESS_QUERIES = [
  chessPuzzleImport,
  chessPuzzleProfile,
  chessPuzzleFeedSettings,
  chessPuzzleInteractions,
  chessPuzzleRatingEvents,
  chessPuzzlePool,
  chessPuzzleNearest,
  chessPuzzleById,
] as const;
