import {
  SYNTHETIC_USERS_CONFIG_PATH,
  SYNTHETIC_USERS_CONTROL_PATH,
  SYNTHETIC_USERS_PATH,
} from '@libs/observatory-shared-ts/observatory-routes';
import { defineSubClient, type SubClient } from '@libs/sub-client-ts/client';
import { createComponent, type JSX, lazy } from 'solid-js';
import { type GameName, GameNamesProvider } from './game-names';

/**
 * The Synthetic Population panel, the Synthetic Users' own part of the User
 * Observatory. Games depend on the platform, so the composition root hands
 * in the registered games' names, which the panel shows wherever it names a
 * game.
 */
export function createSyntheticPopulationClient(options: {
  readonly games: readonly GameName[];
}): SubClient {
  const games = options.games.map(({ id, title }) => ({ id, title }));
  function GameNames(props: { readonly children: JSX.Element }): JSX.Element {
    return createComponent(GameNamesProvider, {
      games,
      get children() {
        return props.children;
      },
    });
  }
  return defineSubClient({
    name: 'synthetic-population',
    chrome: GameNames,
    routes: [
      {
        path: SYNTHETIC_USERS_PATH,
        component: lazy(async () => ({
          default: (await import('./synthetic-population-screen'))
            .SyntheticPopulationScreen,
        })),
      },
      {
        path: SYNTHETIC_USERS_CONFIG_PATH,
        component: lazy(async () => ({
          default: (await import('./synthetic-population-screen'))
            .SyntheticPopulationConfigurationScreen,
        })),
      },
      {
        path: SYNTHETIC_USERS_CONTROL_PATH,
        component: lazy(async () => ({
          default: (await import('./synthetic-population-screen'))
            .SyntheticPopulationControlScreen,
        })),
      },
      {
        path: `${SYNTHETIC_USERS_PATH}/:id`,
        component: lazy(async () => ({
          default: (await import('./synthetic-user-screen'))
            .SyntheticUserScreen,
        })),
      },
    ],
  });
}
