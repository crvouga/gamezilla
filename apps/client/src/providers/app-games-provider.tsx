import {
  GAME_CLIENT_DEFINITIONS,
  GAME_DEFINITIONS,
} from '@libs/games/game-plugins.client';
import { GamesBootstrapFromPlugins } from '@libs/spaces/root/client/module/games-bootstrap-from-plugins';
import type { ReactNode } from 'react';

/** Composed space module and client games registry from `@libs/games`. */
export function AppGamesProvider({
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
