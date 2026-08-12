/**
 * Full `@apps/client` Expo Router context for simulations.
 *
 * Uses the real `app/` filesystem via expo-router's require-context ponyfill,
 * intercepting only the root `_layout` module so sims can inject Io / overrides
 * without Sentry.wrap or polyfill-entry. Does **not** stub individual screens.
 */

import { createRequire } from 'node:module';
import path from 'node:path';

const requireFromHere = createRequire(__filename);

type RequireContext = {
  (id: string): unknown;
  keys(): string[];
  resolve(key: string): string;
  id: string;
};

function loadRequireContextPonyfill(): (base: string) => RequireContext {
  // Deep import of expo-router's Jest testing helper (same as appDir mode).
  return requireFromHere(
    'expo-router/build/testing-library/require-context-ponyfill.js'
  ).default as (base: string) => RequireContext;
}

function isRootLayoutId(id: string): boolean {
  const normalized = id.replace(/^\.\//, '');
  return (
    normalized === '_layout.tsx' ||
    normalized === '_layout.ts' ||
    normalized === '_layout.jsx' ||
    normalized === '_layout.js' ||
    normalized === '_layout'
  );
}

export type ClientAppRootLayoutModule = {
  default: unknown;
  unstable_settings?: unknown;
};

/**
 * Require.context for {@link ExpoRoot} / `renderRouter`-equivalent mounts.
 * Root `_layout` is replaced; every other route file loads from disk as-is.
 */
export function createClientAppRouterContext(
  appDir: string,
  rootLayout: ClientAppRootLayoutModule
): RequireContext {
  const requireContext = loadRequireContextPonyfill();
  const base = requireContext(path.resolve(appDir));
  return Object.assign(
    (id: string) => {
      if (isRootLayoutId(id)) {
        return rootLayout;
      }
      return base(id);
    },
    {
      keys: () => base.keys(),
      resolve: (key: string) => key,
      id: '0',
    }
  );
}
