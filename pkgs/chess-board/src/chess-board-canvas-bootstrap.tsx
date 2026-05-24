import { SpinnerBox } from '@pkgs/ui';
import { SkiaWebRoot } from '@pkgs/ui/components/skia-web-root';
import { lazy, Suspense, type ReactNode } from 'react';
import { setChessBoardCanvas } from './chess-board-canvas-runtime';

/**
 * The Skia canvas chunk MUST stay out of the main bundle's static graph:
 * `@shopify/react-native-skia` evaluates `Skia = JsiSkApi(global.CanvasKit)`
 * at module init, and `CanvasKit` is only present after `SkiaWebRoot` has
 * finished `LoadSkiaWeb`. This bootstrap mounts `SkiaWebRoot` ABOVE the
 * `lazy()` gate so CanvasKit is on `globalThis` before the dynamic import
 * pulls `@shopify/react-native-skia`. The `lazy()` performs the dynamic
 * import once for the lifetime of the app; the resolved component is
 * published to the `chess-board-canvas-runtime` singleton so per-board
 * mounts can read it synchronously via `useChessBoardCanvas` — no per-board
 * Suspense flash, no fallback-to-real layout swap.
 *
 * The lazy resolves to a passthrough wrapper so the bootstrap's children
 * render INSIDE the resolved tree — i.e. children are blocked until the
 * singleton is set. This guarantees `useChessBoardCanvas` returns a
 * non-null component for every `ChessBoard` mount under this bootstrap.
 */
const ChessBoardCanvasGate = lazy(async () => {
  const m = await import('./chess-board-canvas');
  setChessBoardCanvas(m.ChessBoardCanvas);
  return {
    default: ({ children }: { children: ReactNode }): ReactNode => (
      <>{children}</>
    ),
  };
});

/**
 * Mount once at the chess subtree root (`ChessMainMenu`). Loads CanvasKit
 * (web) via `SkiaWebRoot`, then loads the Skia-using chess canvas chunk a
 * single time, then renders `children`. Both gates share one outer
 * `Suspense` so the user sees at most one spinner when entering chess; on
 * native `SkiaWebRoot` is a pass-through so only the lazy gate matters.
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
    <Suspense fallback={<SpinnerBox sx={{ flex: 1 }} />}>
      <SkiaWebRoot>
        <ChessBoardCanvasGate>{children}</ChessBoardCanvasGate>
      </SkiaWebRoot>
    </Suspense>
  );
}
