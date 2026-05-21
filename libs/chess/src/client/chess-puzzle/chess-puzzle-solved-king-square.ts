import type { Square } from '../chess-board/chess-board-types';

const FEN_BLACK_TO_MOVE = 98;

/** King square to crown after mate (FEN active color is side *not* to move). */
export function solvedPuzzleKingSquare(displayFen: string): Square {
  const active = displayFen.trim().split(/\s+/)[1]?.charCodeAt(0);
  return (active === FEN_BLACK_TO_MOVE ? 'e1' : 'e8') as Square;
}
