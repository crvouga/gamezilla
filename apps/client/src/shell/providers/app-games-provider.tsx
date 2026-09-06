import {
  GAME_CLIENT_DEFINITIONS,
  GAME_DEFINITIONS,
} from '@libs/games/game-plugins.client';
import { GamesBootstrapFromPlugins } from '@libs/spaces/root/client/module/games-bootstrap-from-plugins';
import type { JSX } from 'solid-js';

export function AppGamesProvider(props: {
  readonly children: JSX.Element;
}): JSX.Element {
  return (
    <GamesBootstrapFromPlugins
      games={GAME_DEFINITIONS}
      clients={GAME_CLIENT_DEFINITIONS}
    >
      {props.children}
    </GamesBootstrapFromPlugins>
  );
}
