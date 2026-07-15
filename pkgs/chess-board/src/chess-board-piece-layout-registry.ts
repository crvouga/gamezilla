import type { SharedValue } from 'react-native-reanimated';

export type PieceLayoutHandle = {
  topLeftX: SharedValue<number>;
  topLeftY: SharedValue<number>;
  pieceSize: number;
};

const handles = new Map<number, PieceLayoutHandle>();

/** Register a piece's UI-thread layout slots for zero-React snap on drop. */
export function registerPieceLayout(
  pieceKey: number,
  handle: PieceLayoutHandle
): () => void {
  handles.set(pieceKey, handle);
  return () => {
    if (handles.get(pieceKey) === handle) handles.delete(pieceKey);
  };
}

/** Snap a registered piece to a board-space center. Returns false if missing. */
export function snapPieceLayout(
  pieceKey: number,
  centerX: number,
  centerY: number
): boolean {
  const handle = handles.get(pieceKey);
  if (!handle) return false;
  const half = handle.pieceSize / 2;
  handle.topLeftX.value = centerX - half;
  handle.topLeftY.value = centerY - half;
  return true;
}
