import {
  GAME_CLIENT_DEFINITIONS,
  GAME_DEFINITIONS,
} from '@libs/games/game-plugins.client';
import { GamesBootstrapFromPlugins } from '@libs/spaces/client/module/games-bootstrap-from-plugins';
import type { ReactNode } from 'react';

/**
 * Provides the composed `SpaceModule` and client games registry from the eager
 * `@libs/games` registry so the rest of the app can mount spaces / games without
 * any direct dependency on a specific game module.
 */
export function GamesBootstrapProvider({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  return (
    <GamesBootstrapFromPlugins
      games={GAME_DEFINITIONS}
      clients={GAME_CLIENT_DEFINITIONS}
    >
      {children}
    </GamesBootstrapFromPlugins>
  );
}
