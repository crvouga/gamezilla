import { chessPuzzleLoad } from '@libs/chess-puzzle-shared/puzzle-load-table';

/**
 * Chess's own table: the Lichess load its puzzle import pipeline keeps. The
 * puzzle catalogue and people's puzzle progress are the platform's
 * (`GAME_PUZZLE_SUB`).
 */
export const CHESS_TABLES = [chessPuzzleLoad] as const;
