/** @jsxImportSource @solidjs/web */
import type { JSX } from '@solidjs/web';
import type { GamesBootstrapFromPluginsProps } from './games-bootstrap-from-plugins';
import { GamesBootstrapFromPlugins } from './games-bootstrap-from-plugins';

export type GameRegistry = Pick<
  GamesBootstrapFromPluginsProps,
  'games' | 'clients'
>;

/** The composition root supplies the registry before any screen mounts. */
export function AppGamesProvider(props: {
  readonly registry: GameRegistry;
  readonly children: JSX.Element;
}): JSX.Element {
  return (
    <GamesBootstrapFromPlugins
      games={props.registry.games}
      clients={props.registry.clients}
    >
      {props.children}
    </GamesBootstrapFromPlugins>
  );
}
