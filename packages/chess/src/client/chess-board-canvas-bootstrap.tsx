import { Box, Spinner } from '@gamezilla/ui';
import { lazy, Suspense, type ReactNode } from 'react';
import { setChessBoardCanvas } from './chess-board-canvas-runtime';

/**
 * The Skia canvas chunk MUST stay out of the main bundle's static graph:
 * `@shopify/react-native-skia` evaluates `Skia = JsiSkApi(global.CanvasKit)`
 * at module init, and `CanvasKit` is only present after `SkiaWebRoot` has
 * finished `LoadSkiaWeb` (gated by the app-root Suspense in
 * `app-providers.tsx`). This single `lazy()` performs the dynamic import
 * once for the lifetime of the app; the resolved component is published to
 * the `chess-board-canvas-runtime` singleton so per-board mounts can read
 * it synchronously via `useChessBoardCanvas` — no per-board Suspense flash,
 * no fallback-to-real layout swap.
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
 * Mount once at the chess subtree root (`ChessMainMenu`). Loads the
 * Skia-using chess canvas chunk a single time, then renders `children`.
 * Kept inside the chess package so `@gamezilla/client` stays decoupled
 * from any feature package — the only cross-package responsibility at the
 * app root is `SkiaWebRoot`.
 */
export function ChessBoardCanvasBootstrap({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  return (
    <Suspense
      fallback={
        <Box sx={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Spinner />
        </Box>
      }
    >
      <ChessBoardCanvasGate>{children}</ChessBoardCanvasGate>
    </Suspense>
  );
}
