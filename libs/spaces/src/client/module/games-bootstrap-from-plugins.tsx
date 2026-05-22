import { useEffect, useState, type ReactNode } from 'react';

import type { GameClientDefinition } from '../../shared/game';
import type { GamePlugin } from '../../shared/game-plugin';
import {
  composeSpaceRoomModule,
  loadGameClientDefinitions,
  loadGameDefinitions,
} from '../../shared/load-game-plugins';
import { GamesRegistryProvider } from './games-registry-context';
import {
  SpaceModuleProvider,
  type SpaceRoomModule,
} from './space-module-context';

type Resolved = {
  readonly module: SpaceRoomModule;
  readonly clients: readonly GameClientDefinition[];
};

/**
 * Module-level cache keyed by the exact plugin-list reference. Plugin lists
 * are expected to be module-level constants (`as const satisfies …`), so
 * referential equality is the right cache key — and it preserves the same
 * "singleton across renders" guarantee that the old eager `APP_SPACE_MODULE`
 * had, so `useSpaceRoomConnection`'s `module` dep does not tear down the
 * WebSocket on every parent re-render.
 */
const cache = new WeakMap<readonly GamePlugin[], Promise<Resolved>>();

function resolvePlugins(plugins: readonly GamePlugin[]): Promise<Resolved> {
  const cached = cache.get(plugins);
  if (cached !== undefined) return cached;
  const promise = (async (): Promise<Resolved> => {
    const [defs, clients] = await Promise.all([
      loadGameDefinitions(plugins),
      loadGameClientDefinitions(plugins),
    ]);
    return { module: composeSpaceRoomModule(defs), clients };
  })();
  cache.set(plugins, promise);
  return promise;
}

export type GamesBootstrapFromPluginsProps = {
  readonly plugins: readonly GamePlugin[];
  /** Rendered while plugins are still loading. Defaults to `null`. */
  readonly fallback?: ReactNode;
  readonly children: ReactNode;
};

/**
 * Composition-root component that lazy-loads a set of {@link GamePlugin}s,
 * builds the composed `SpaceModule`, and provides both that module and the
 * client game registry to descendants. Until loading completes, `children`
 * is not rendered (so `useSpaceModule` is never called before the module
 * exists); the optional `fallback` is rendered in its place.
 */
export function GamesBootstrapFromPlugins({
  plugins,
  fallback = null,
  children,
}: GamesBootstrapFromPluginsProps): ReactNode {
  const [resolved, setResolved] = useState<Resolved | null>(null);

  useEffect(() => {
    let cancelled = false;
    void resolvePlugins(plugins).then((r) => {
      if (!cancelled) setResolved(r);
    });
    return () => {
      cancelled = true;
    };
  }, [plugins]);

  if (resolved === null) return <>{fallback}</>;

  return (
    <SpaceModuleProvider value={resolved.module}>
      <GamesRegistryProvider value={resolved.clients}>
        {children}
      </GamesRegistryProvider>
    </SpaceModuleProvider>
  );
}
