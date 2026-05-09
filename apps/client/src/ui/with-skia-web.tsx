/* eslint-disable lingui/no-unlocalized-strings */
import { Spinner } from '@gamezilla/lib/ui';
import { Platform } from 'react-native';
import {
  Suspense,
  lazy,
  useMemo,
  type ComponentType,
  type LazyExoticComponent,
  type ReactNode,
} from 'react';

type WithSkiaWebProps<P extends object> = {
  getComponent: () => Promise<{ default: ComponentType<P> }>;
  componentProps: P;
  fallback?: ReactNode;
};

type ShopifyWithSkiaWebFn = <TProps extends object>(p: {
  fallback?: ReactNode;
  getComponent: () => Promise<{ default: ComponentType<TProps> }>;
  componentProps?: TProps;
  opts?: { locateFile?: (file: string) => string };
}) => ReactNode;

/**
 * Defers evaluation of the Skia-using component until after CanvasKit is
 * loaded on web. On native, uses `React.lazy` for a single uniform code path.
 *
 * Prefer `SkiaWebRoot` (`skia-web-root.tsx`) at the app root plus a direct Skia
 * import when the subtree is always mounted after bootstrap (e.g. chess board).
 *
 * IMPORTANT: callers MUST pass a `getComponent` that performs a *dynamic*
 * `import(...)` of the Skia-using module. Never statically import that
 * module from a parent chunk that mounts this wrapper, or its top-level
 * `import { Skia } from '@shopify/react-native-skia'` will evaluate before
 * `LoadSkiaWeb` runs and will permanently capture `global.CanvasKit ===
 * undefined` in factory closures (this manifests as `TypeError: Cannot read
 * properties of undefined (reading 'Font')` later when calling Skia APIs).
 */
export function WithSkiaWeb<P extends object>(
  props: WithSkiaWebProps<P>
): ReactNode {
  const { getComponent, componentProps, fallback } = props;
  const isWeb = Platform.OS === 'web';

  const ShopifyHoc = useMemo<ShopifyWithSkiaWebFn | null>(() => {
    if (!isWeb) return null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require('@shopify/react-native-skia/lib/module/web');
      return (mod.WithSkiaWeb ?? null) as ShopifyWithSkiaWebFn | null;
    } catch {
      return null;
    }
  }, [isWeb]);

  const NativeLazy = useMemo<LazyExoticComponent<ComponentType<P>> | null>(
    () => (isWeb ? null : lazy(getComponent)),
    // The dynamic import must only be created once for the lifetime of this
    // mount; recreating it would re-trigger module evaluation on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isWeb]
  );

  if (isWeb && ShopifyHoc !== null) {
    return (
      <ShopifyHoc<P>
        fallback={fallback ?? <Spinner />}
        componentProps={componentProps}
        opts={{
          locateFile: (file) =>
            file.endsWith('.wasm') ? '/canvaskit.wasm' : '/' + file,
        }}
        getComponent={getComponent}
      />
    );
  }

  if (NativeLazy !== null) {
    const LazyComp = NativeLazy;
    return (
      <Suspense fallback={fallback ?? <Spinner />}>
        <LazyComp {...componentProps} />
      </Suspense>
    );
  }

  return fallback ?? <Spinner />;
}
