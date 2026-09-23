import { chessPuzzleById } from '../use-cases/load-puzzle-by-id/shared/chess-puzzle-by-id-query';
import { chessPuzzleInteractions } from '../use-cases/load-puzzle-interactions/shared/chess-puzzle-interactions-query';
import { chessPuzzlePool } from '../use-cases/load-puzzle-pool/shared/chess-puzzle-pool-query';
import { chessPuzzleProfile } from '../use-cases/load-puzzle-profile/shared/chess-puzzle-profile-query';
import { chessPuzzleRatingEvents } from '../use-cases/load-puzzle-rating-events/shared/chess-puzzle-rating-events-query';

export const CHESS_QUERIES = [
  chessPuzzleProfile,
  chessPuzzleInteractions,
  chessPuzzleRatingEvents,
  chessPuzzlePool,
  chessPuzzleById,
] as const;
