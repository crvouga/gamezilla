import { chessPuzzleLoad } from '@libs/chess-puzzle-shared/puzzle-load-table';
import {
  chessPuzzleFeedSettings,
  chessPuzzleInteractions,
  chessPuzzleProfiles,
  chessPuzzleRatingEvents,
  chessPuzzles,
} from '@libs/game-puzzle-shared/puzzle-tables';

/**
 * The puzzle tables the platform defines, and the Lichess load chess's own
 * import pipeline keeps, in their established order.
 */
export const CHESS_TABLES = [
  chessPuzzles,
  chessPuzzleLoad,
  chessPuzzleProfiles,
  chessPuzzleFeedSettings,
  chessPuzzleRatingEvents,
  chessPuzzleInteractions,
] as const;
