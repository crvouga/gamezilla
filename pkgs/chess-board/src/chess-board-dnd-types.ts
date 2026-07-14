import type { PieceCode, Square } from './chess-board-types';

/** Payload carried by each piece `Draggable`. */
export type ChessPieceDragData = {
  id: string;
  from: Square;
  code: PieceCode;
};
