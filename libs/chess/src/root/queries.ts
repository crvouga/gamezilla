import { chessPuzzleInteractions } from '../use-cases/load-puzzle-interactions/shared/chess-puzzle-interactions-query';
import { chessPuzzlePool } from '../use-cases/load-puzzle-pool/shared/chess-puzzle-pool-query';
import { chessPuzzleProfile } from '../use-cases/load-puzzle-profile/shared/chess-puzzle-profile-query';

export const CHESS_QUERIES = [
  chessPuzzleProfile,
  chessPuzzleInteractions,
  chessPuzzlePool,
] as const;
