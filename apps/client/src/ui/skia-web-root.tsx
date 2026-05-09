/* eslint-disable lingui/no-unlocalized-strings -- CanvasKit asset paths / dev assertions */
import { assert } from '@gamezilla/lib/assert';
import { Box, Spinner } from '@gamezilla/lib/ui';
import { useEffect, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

const canvaskitLocateFile = (file: string): string =>
  file.endsWith('.wasm') ? '/canvaskit.wasm' : `/${file}`;

/**
 * Loads CanvasKit once on web (same contract as Shopify {@link LoadSkiaWeb}).
 * Safe to call multiple times; subsequent calls resolve immediately.
 *
 * Do not statically import `@shopify/react-native-skia` (or modules that do)
 * before this completes — `Skia` is created at import time from
 * `global.CanvasKit`. Use `React.lazy(() => import(...))` after
 * {@link assertSkiaWebLoaded} for Skia surfaces (see `chess-board.tsx`).
 */
export async function loadSkiaWebOnce(): Promise<void> {
  if (Platform.OS !== 'web') return;
  if (typeof globalThis.CanvasKit !== 'undefined') return;
  const { LoadSkiaWeb } = await import(
    '@shopify/react-native-skia/lib/module/web/LoadSkiaWeb'
  );
  await LoadSkiaWeb({ locateFile: canvaskitLocateFile });
}

/**
 * Web: blocks the subtree until {@link loadSkiaWebOnce} has finished so Skia
 * modules can import safely. Native: no-op pass-through.
 */
export function SkiaWebRoot({ children }: { children: ReactNode }): ReactNode {
  const [ready, setReady] = useState(Platform.OS !== 'web');

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    let cancelled = false;
    void loadSkiaWebOnce().then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) {
    return (
      <Box sx={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Spinner />
      </Box>
    );
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
