import { useSyncExternalStore, type ComponentType } from 'react';
import type { ChessBoardCanvasProps } from './chess-board-canvas';

export type ChessBoardCanvasComponent = ComponentType<ChessBoardCanvasProps>;

/**
 * Module-level slot for the dynamically loaded `ChessBoardCanvas`.
 *
 * `chess-board-canvas` statically pulls `@shopify/react-native-skia`, which
 * captures `Skia = JsiSkApi(global.CanvasKit)` at import time — so the chunk
 * can only be imported AFTER `SkiaWebRoot` finishes loading CanvasKit on
 * web (the app-root Suspense in `app-providers.tsx` enforces that ordering).
 * `ChessBoardCanvasBootstrap` (mounted at `ChessMainMenu`, the chess
 * subtree root) does the import once and parks the resolved component
 * here. Per-board mounts read it synchronously via
 * {@link useChessBoardCanvas} — no per-board Suspense boundary.
 */
let cached: ChessBoardCanvasComponent | null = null;
const listeners = new Set<() => void>();

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getSnapshot = (): ChessBoardCanvasComponent | null => cached;

/** Internal — published by the app-root bootstrap once the chunk resolves. */
export function setChessBoardCanvas(c: ChessBoardCanvasComponent): void {
  if (cached === c) return;
  cached = c;
  for (const listener of listeners) listener();
}

/**
 * Synchronous read of the loaded canvas component. Returns `null` only when
 * called outside `ChessBoardCanvasBootstrap` (which gates its children on
 * the singleton being set), so callers within the chess subtree can treat
 * the result as non-null after asserting.
 */
export function useChessBoardCanvas(): ChessBoardCanvasComponent | null {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
