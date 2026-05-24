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
 * Mount this colocated with the feature that needs Skia (e.g. inside the
 * chess bootstrap), under a `<Suspense fallback={...}>` boundary that owns
 * the loading UI; this component intentionally has no UI of its own. Do
 * NOT mount at the app root — that would suspend every route on CanvasKit
 * WASM even when no Skia surface is rendered.
 */
export function SkiaWebRoot({ children }: { children: ReactNode }): ReactNode {
  if (Platform.OS === 'web') {
    use(getSkiaWebPromise());
  }
  return <>{children}</>;
}

/** Call at the top of Skia surfaces (e.g. chess board) on web after the colocated bootstrap. */
export function assertSkiaWebLoaded(): void {
  if (Platform.OS !== 'web') return;
  assert.ok(
    typeof globalThis.CanvasKit !== 'undefined',
    'Skia Web must be bootstrapped via SkiaWebRoot before mounting Skia canvases'
  );
}
