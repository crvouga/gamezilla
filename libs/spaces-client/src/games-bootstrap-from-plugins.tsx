import type {
  GameClientDefinition,
  GameDefinition,
} from '@libs/spaces-shared/game';
import { composeSpaceRoomModule } from '@libs/spaces-shared/load-game-plugins';
import { useClock } from '@pkgs/clock-client/solid';
import { TurnGamesProvider } from '@pkgs/turn-game-client/turn-games-context';
import { createTurnGames } from '@pkgs/turn-game-shared/game-rules';
import { useRandom } from '@pkgs/uuid-client/solid';
import type { JSX } from 'solid-js';
import { untrack } from 'solid-js';
import { GamesRegistryProvider } from './games-registry-context';
import type { SpaceRoomModule } from './space-module-context';
import { SpaceModuleProvider } from './space-module-context';

export type GamesBootstrapFromPluginsProps = {
  readonly games: readonly GameDefinition[];
  readonly clients: readonly GameClientDefinition[];
  readonly children: JSX.Element;
};

/**
 * Composition-root component that provides the composed `SpaceModule` and
 * client games registry from an eager {@link GAME_DEFINITIONS} registry.
 */
export function GamesBootstrapFromPlugins(
  props: GamesBootstrapFromPluginsProps
): JSX.Element {
  const clock = useClock();
  const random = useRandom();
  // Composition-root configuration: read once, not tracked.
  const games = untrack(() => props.games);
  const clients = untrack(() => props.clients);
  const spaceRoomModule: SpaceRoomModule = composeSpaceRoomModule(
    games,
    clock.now,
    random
  );

  return (
    <SpaceModuleProvider value={spaceRoomModule}>
      <GamesRegistryProvider value={clients}>
        <TurnGamesProvider
          rules={createTurnGames(
            games.flatMap((game) =>
              game.turnGame === undefined ? [] : [game.turnGame]
            )
          )}
          presentations={clients.flatMap((client) =>
            client.presentation === undefined ? [] : [client.presentation]
          )}
        >
          {props.children}
        </TurnGamesProvider>
      </GamesRegistryProvider>
    </SpaceModuleProvider>
  );
}
