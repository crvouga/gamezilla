import { GAME_PLUGINS } from '@libs/games/game-plugins.client';
import { GamesBootstrapFromPlugins } from '@libs/spaces/client/module/games-bootstrap-from-plugins';
import type { ReactNode } from 'react';

/**
 * Lazy-loads every game in {@link GAME_PLUGINS}, then provides the composed
 * `SpaceModule` and client games registry so the rest of the app can mount
 * spaces / games without any direct dependency on a specific game module.
 */
export function GamesBootstrapProvider({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  return (
    <GamesBootstrapFromPlugins plugins={GAME_PLUGINS}>
      {children}
    </GamesBootstrapFromPlugins>
  );
}
