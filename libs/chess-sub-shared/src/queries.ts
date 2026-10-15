import { chessMultiplayerSession } from '@libs/chess-matchmaking-shared/chess-multiplayer-session-query';
import { chessMultiplayerSpace } from '@libs/chess-matchmaking-shared/chess-multiplayer-space-query';
import { chessPuzzleById } from '@libs/chess-puzzle-shared/chess-puzzle-by-id-query';
import { chessPuzzleFeedSettings } from '@libs/chess-puzzle-shared/chess-puzzle-feed-settings-query';
import { chessPuzzleInteractions } from '@libs/chess-puzzle-shared/chess-puzzle-interactions-query';
import {
  chessPuzzleNearest,
  chessPuzzlePool,
} from '@libs/chess-puzzle-shared/chess-puzzle-pool-query';
import { chessPuzzleProfile } from '@libs/chess-puzzle-shared/chess-puzzle-profile-query';
import { chessPuzzleRatingEvents } from '@libs/chess-puzzle-shared/chess-puzzle-rating-events-query';
import { chessPuzzleImport } from '@libs/chess-puzzle-shared/puzzle-import-query';

export const CHESS_QUERIES = [
  chessPuzzleImport,
  chessMultiplayerSession,
  chessMultiplayerSpace,
  chessPuzzleProfile,
  chessPuzzleFeedSettings,
  chessPuzzleInteractions,
  chessPuzzleRatingEvents,
  chessPuzzlePool,
  chessPuzzleNearest,
  chessPuzzleById,
] as const;
