import type {
  CellHighlight,
  Square,
} from '@pkgs/chess-board/chess-board-types';
import type { SolveStatus } from './use-chess-puzzle-solver';
import { solvedPuzzleKingSquare } from './chess-puzzle-solved-king-square';

export function deriveChessPuzzleCellHighlights(args: {
  status: SolveStatus;
  lastCorrectToSquare: Square | null;
  solvedKingSquare: Square | null;
  successColor: string;
}): Partial<Record<Square, CellHighlight>> {
  const {
    status,
    lastCorrectToSquare,
    solvedKingSquare,
    successColor,
  } = args;
  const out: Partial<Record<Square, CellHighlight>> = {};

  if (lastCorrectToSquare !== null) {
    out[lastCorrectToSquare] = {
      color: successColor,
      ring: true,
      opacity: 0.75,
    };
  }

  if (status === 'solved' && solvedKingSquare !== null) {
    out[solvedKingSquare] = {
      color: successColor,
      ring: true,
      opacity: 0.9,
    };
  }

  return out;
}

export function solvedHighlightKingSquare(displayFen: string): Square {
  return solvedPuzzleKingSquare(displayFen);
}
