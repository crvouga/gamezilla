import {
  startPuzzleImport,
  stopPuzzleImport,
} from '@libs/chess-puzzle-shared/puzzle-import-mutations';

export const CHESS_MUTATIONS = [startPuzzleImport, stopPuzzleImport] as const;
