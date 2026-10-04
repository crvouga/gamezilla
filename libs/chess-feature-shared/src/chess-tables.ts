import { CHESS_MULTIPLAYER_TABLES } from '@libs/chess-matchmaking-shared/multiplayer-tables';
import { CHESS_PUZZLE_TABLES } from '@libs/chess-puzzle-shared/puzzle-tables';

/** Every table the chess feature owns, across its slices. */
export const CHESS_TABLES = [
  ...CHESS_MULTIPLAYER_TABLES,
  ...CHESS_PUZZLE_TABLES,
] as const;
