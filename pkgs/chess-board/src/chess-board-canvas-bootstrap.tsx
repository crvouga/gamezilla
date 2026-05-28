import { LoadingState } from '@pkgs/ui';
import { Suspense, use, type ReactNode } from 'react';
import {
  preloadChessBoardCanvas,
  useChessBoardCanvas,
} from './chess-board-canvas-runtime';

/**
 * The Skia canvas chunk MUST stay out of the main bundle's static graph:
 * `@shopify/react-native-skia` evaluates `Skia = JsiSkApi(global.CanvasKit)`
 * at module init, and `CanvasKit` is only present after CanvasKit WASM has
 * finished loading on web. `preloadChessBoardCanvas` enforces that ordering
 * (CanvasKit first, then the dynamic `import('./chess-board-canvas')`) and
 * publishes the resolved component to the `chess-board-canvas-runtime`
 * singleton, so per-board mounts read it synchronously via
 * `useChessBoardCanvas` — no per-board Suspense flash.
 */
function ChessBoardCanvasGate({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  // Synchronous when the canvas was preloaded (e.g. from the games picker);
  // otherwise suspend on the shared preload promise until it resolves.
  if (useChessBoardCanvas() === null) use(preloadChessBoardCanvas());
  return <>{children}</>;
}

/**
 * Mount once at the chess subtree root (`ChessMainMenu`). Renders `children`
 * as soon as the canvas singleton is set — instantly if
 * {@link preloadChessBoardCanvas} was fired ahead of time (the common path,
 * triggered while the user browses the games picker), otherwise after a one-
 * time CanvasKit + chunk load behind the shared `Suspense` fallback.
 *
 * Bootstrap stays inside the chess package so `@apps/client` does not
 * import `@shopify/react-native-skia` (or any Skia bootstrap) — non-chess
 * routes never pay the CanvasKit WASM load cost.
 */
export function ChessBoardCanvasBootstrap({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  return (
    <Suspense fallback={<LoadingState />}>
      <ChessBoardCanvasGate>{children}</ChessBoardCanvasGate>
    </Suspense>
  );
}
