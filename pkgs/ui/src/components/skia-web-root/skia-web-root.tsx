import { assert } from '@pkgs/assert';
import { use, type ReactNode } from 'react';
import { Platform } from 'react-native';

const canvaskitLocateFile = (file: string): string =>
  file.endsWith('.wasm') ? '/generated/skia/canvaskit.wasm' : `/${file}`;

/**
 * Loads CanvasKit once on web (same contract as Shopify {@link LoadSkiaWeb}).
 * Safe to call multiple times; subsequent calls resolve immediately.
 *
 * Do not statically import `@shopify/react-native-skia` (or modules that do)
 * before this completes — `Skia` is created at import time from
 * `global.CanvasKit`. Use `React.lazy(() => import(...))` after
 * {@link assertSkiaWebLoaded} for Skia surfaces.
 */
export async function loadSkiaWebOnce(): Promise<void> {
  if (Platform.OS !== 'web') return;
  if (typeof globalThis.CanvasKit !== 'undefined') return;
  const { LoadSkiaWeb } =
    await import('@shopify/react-native-skia/lib/module/web/LoadSkiaWeb');
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
 * Web: suspends until {@link loadSkiaWebOnce} has finished so Skia modules
 * can import safely. Native: no-op pass-through.
 *
 * Wrap with a `<Suspense fallback={...}>` boundary at the app root — that
 * boundary owns the loading UI; this component intentionally has no UI of
 * its own. Suspending (instead of state-gating) means the rest of the
 * provider tree above the Suspense boundary keeps its identity across the
 * loading transition.
 */
export function SkiaWebRoot({ children }: { children: ReactNode }): ReactNode {
  if (Platform.OS === 'web') {
    use(getSkiaWebPromise());
  }
  return <>{children}</>;
}

/** Call at the top of Skia surfaces (e.g. chess board) on web after root bootstrap. */
export function assertSkiaWebLoaded(): void {
  if (Platform.OS !== 'web') return;
  assert.ok(
    typeof globalThis.CanvasKit !== 'undefined',
    'Skia Web must be bootstrapped at the app root (SkiaWebRoot) before mounting Skia canvases'
  );
}
