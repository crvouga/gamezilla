import { assert } from '@pkgs/assert';
import { type ReactNode, use } from 'react';

const canvaskitLocateFile = (file: string): string =>
  file.endsWith('.wasm') ? '/generated/skia/canvaskit.wasm' : `/${file}`;

/**
 * Loads CanvasKit once on web (same contract as Shopify {@link LoadSkiaWeb}).
 * Safe to call multiple times; subsequent calls resolve immediately.
 *
 * Do not statically import `@shopify/react-native-skia` (or modules that do)
 * before this completes - `Skia` is created at import time from
 * `global.CanvasKit`. Use `React.lazy(() => import(...))` after
 * {@link assertSkiaWebLoaded} for Skia surfaces.
 */
export async function loadSkiaWebOnce(): Promise<void> {
  if (typeof globalThis.CanvasKit !== 'undefined') return;
  const { LoadSkiaWeb } = await import(
    '@shopify/react-native-skia/lib/module/web/LoadSkiaWeb'
  );
  await LoadSkiaWeb({ locateFile: canvaskitLocateFile });
}

/**
 * Stable promise reference for `React.use()`. `use()` requires the same
 * thenable across renders or it would re-suspend forever.
 */
let skiaWebPromise: Promise<void> | null = null;
function getSkiaWebPromise(): Promise<void> {
  if (skiaWebPromise === null) {
    skiaWebPromise = loadSkiaWebOnce();
  }
  return skiaWebPromise;
}

/**
 * Warm CanvasKit ahead of time, sharing the exact promise `SkiaWebRoot`
 * suspends on. Call this before a Skia surface mounts (for example while the
 * user browses a menu) so the WASM is initialized before first render.
 */
export function preloadSkiaWeb(): Promise<void> {
  return getSkiaWebPromise();
}

/**
 * Web: suspends until {@link loadSkiaWebOnce} has finished so Skia modules
 * can import safely.
 *
 * Mount this colocated with the feature that needs Skia (for example inside
 * the chess bootstrap), under a `<Suspense fallback={...}>` boundary that
 * owns the loading UI.
 */
export function SkiaWebRoot({ children }: { children: ReactNode }): ReactNode {
  use(getSkiaWebPromise());
  return <>{children}</>;
}

/** Call at the top of Skia surfaces on web after the colocated bootstrap. */
export function assertSkiaWebLoaded(): void {
  assert.ok(
    typeof globalThis.CanvasKit !== 'undefined',
    'Skia Web must be bootstrapped via SkiaWebRoot before mounting Skia canvases'
  );
}
