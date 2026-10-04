import { chessPuzzleById } from '../use-cases/load-puzzle-by-id/shared/chess-puzzle-by-id-query';
import { chessPuzzleFeedSettings } from '../use-cases/load-puzzle-feed-settings/shared/chess-puzzle-feed-settings-query';
import { chessPuzzleInteractions } from '../use-cases/load-puzzle-interactions/shared/chess-puzzle-interactions-query';
import { chessPuzzlePool } from '../use-cases/load-puzzle-pool/shared/chess-puzzle-pool-query';
import { chessPuzzleProfile } from '../use-cases/load-puzzle-profile/shared/chess-puzzle-profile-query';
import { chessPuzzleRatingEvents } from '../use-cases/load-puzzle-rating-events/shared/chess-puzzle-rating-events-query';
import { chessMultiplayerSession } from '../use-cases/open-multiplayer/shared/chess-multiplayer-session-query';
import { chessMultiplayerGame } from '../use-cases/open-multiplayer-game/shared/chess-multiplayer-game-query';

export { chessMultiplayerGame, chessMultiplayerSession, chessPuzzleProfile };

export const CHESS_QUERIES = [
  chessMultiplayerSession,
  chessMultiplayerGame,
  chessPuzzleProfile,
  chessPuzzleFeedSettings,
  chessPuzzleInteractions,
  chessPuzzleRatingEvents,
  chessPuzzlePool,
  chessPuzzleById,
] as const;
