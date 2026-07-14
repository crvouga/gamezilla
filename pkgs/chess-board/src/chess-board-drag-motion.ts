import type { SharedValue } from 'react-native-reanimated';
import { useSharedValue } from 'react-native-reanimated';
import { HOVER_NONE } from './chess-board-geometry';

/** Sentinel: no piece is being dragged. */
export const DRAG_PIECE_NONE = -1;

export type ChessBoardDragMotion = {
  /** Hashed piece id currently dragging, or {@link DRAG_PIECE_NONE}. */
  pieceKey: SharedValue<number>;
  /** Square index (0–63) of the drag origin, or {@link HOVER_NONE}. */
  fromIndex: SharedValue<number>;
  tx: SharedValue<number>;
  ty: SharedValue<number>;
  scale: SharedValue<number>;
};

export function hashPieceId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (Math.imul(h, 31) + id.charCodeAt(i)) | 0;
  }
  return h === DRAG_PIECE_NONE ? 1 : h;
}

/** Board-level drag SharedValues shared by all Skia pieces + the gesture. */
export function useChessBoardDragMotion(): ChessBoardDragMotion {
  const pieceKey = useSharedValue(DRAG_PIECE_NONE);
  const fromIndex = useSharedValue(HOVER_NONE);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const scale = useSharedValue(1);
  return { pieceKey, fromIndex, tx, ty, scale };
}

export function clearDragMotion(drag: ChessBoardDragMotion): void {
  'worklet';
  drag.pieceKey.value = DRAG_PIECE_NONE;
  drag.fromIndex.value = HOVER_NONE;
  drag.tx.value = 0;
  drag.ty.value = 0;
  drag.scale.value = 1;
}

export function clearHover(hoverSquareIndex: SharedValue<number>): void {
  'worklet';
  hoverSquareIndex.value = HOVER_NONE;
}

/** Empty 64-slot key table (non-draggable / empty = DRAG_PIECE_NONE). */
export function emptyDragKeyTable(): number[] {
  return Array.from({ length: 64 }, () => DRAG_PIECE_NONE);
}
