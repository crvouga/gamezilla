import { ChessBoardBenchPage } from '@pkgs/chess-board/bench/chess-board-bench-page';
import type { ComponentEntry } from '@pkgs/ui';
import ChessBoardExample from './chess-board-example';

export const CHESS_COMPONENT_ENTRIES: readonly ComponentEntry[] = [
  {
    id: 'chess-board',
    title: 'ChessBoard',
    group: 'Games',
    Example: ChessBoardExample,
  },
  {
    id: 'chess-board-bench',
    title: 'ChessBoard bench',
    group: 'Games',
    Example: ChessBoardBenchPage,
  },
];
