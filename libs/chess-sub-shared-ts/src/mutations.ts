import {
  startPuzzleImport,
  stopPuzzleImport,
} from '@libs/chess-puzzle-shared-ts/puzzle-import-mutations';

export const CHESS_MUTATIONS = [startPuzzleImport, stopPuzzleImport] as const;
