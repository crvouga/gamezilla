import type { ReactNode } from 'react';

const resolvedPromise = Promise.resolve();

/**
 * Native/default implementation. `skia-web-root.web.tsx` provides the real
 * CanvasKit loader for web, while this file keeps native bundles free of
 * web-only Skia loader imports.
 */
export function loadSkiaWebOnce(): Promise<void> {
  return resolvedPromise;
}

/** Native/default no-op preload. */
export function preloadSkiaWeb(): Promise<void> {
  return resolvedPromise;
}

/** Native/default pass-through wrapper. */
export function SkiaWebRoot({ children }: { children: ReactNode }): ReactNode {
  return <>{children}</>;
}

/** Native/default no-op assertion; web implementation validates CanvasKit. */
export function assertSkiaWebLoaded(): void {}
