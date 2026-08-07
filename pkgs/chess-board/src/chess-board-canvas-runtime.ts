import { preloadSkiaWeb } from '@pkgs/ui/components/skia-web-root';
import { type ComponentType, useSyncExternalStore } from 'react';
import type { ChessBoardCanvasProps } from './chess-board-canvas';

export type ChessBoardCanvasComponent = ComponentType<ChessBoardCanvasProps>;

/**
 * Module-level slot for the dynamically loaded `ChessBoardCanvas`.
 *
 * `chess-board-canvas` statically pulls `@shopify/react-native-skia`, which
 * captures `Skia = JsiSkApi(global.CanvasKit)` at import time — so the chunk
 * can only be imported AFTER `SkiaWebRoot` finishes loading CanvasKit on
 * web. `ChessBoardCanvasBootstrap` (mounted at `ChessMainMenu`, the chess
 * subtree root) wraps the lazy gate in `SkiaWebRoot` to enforce that
 * ordering, then does the import once and parks the resolved component
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

/** Internal — published by `ChessBoardCanvasBootstrap` once the chunk resolves. */
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

/**
 * Stable promise that warms CanvasKit (web) and the Skia-using canvas chunk,
 * then publishes the resolved component to the singleton above.
 *
 * Idempotent: the first call kicks off the load; later calls return the same
 * promise. `ChessBoardCanvasBootstrap` suspends on this when the singleton is
 * not yet set, and callers can fire it ahead of time (e.g. from the games
 * picker) so the canvas is already cached when chess mounts — eliminating the
 * Suspense fallback (and the main-thread-blocked frozen spinner) entirely.
 */
let canvasPreloadPromise: Promise<void> | null = null;
export function preloadChessBoardCanvas(): Promise<void> {
  if (canvasPreloadPromise === null) {
    canvasPreloadPromise = (async (): Promise<void> => {
      await preloadSkiaWeb();
      const m = await import('./chess-board-canvas');
      setChessBoardCanvas(m.ChessBoardCanvas);
      // Piece rasters load on first board mount via `usePieceCaches` — do not
      // kick them here. Preloading mid-CanvasKit init produced corrupt SkImages
      // on web (pieces drew oversized / mis-centered).
    })();
  }
  return canvasPreloadPromise;
}
