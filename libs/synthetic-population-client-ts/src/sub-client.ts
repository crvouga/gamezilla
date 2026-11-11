import {
  SYNTHETIC_POPULATION_EVENTS_PATH,
  SYNTHETIC_POPULATION_SETTINGS_PATH,
  SYNTHETIC_POPULATION_WORKERS_PATH,
  SYNTHETIC_USER_DIRECTORY_PATH,
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
        path: SYNTHETIC_USER_DIRECTORY_PATH,
        component: lazy(async () => ({
          default: (await import('./synthetic-users-screen'))
            .SyntheticUsersScreen,
        })),
      },
      {
        path: SYNTHETIC_POPULATION_WORKERS_PATH,
        component: lazy(async () => ({
          default: (await import('./synthetic-population-workers-screen'))
            .SyntheticPopulationWorkersScreen,
        })),
      },
      {
        path: SYNTHETIC_POPULATION_EVENTS_PATH,
        component: lazy(async () => ({
          default: (await import('./synthetic-population-events-screen'))
            .SyntheticPopulationEventsScreen,
        })),
      },
      {
        path: SYNTHETIC_POPULATION_SETTINGS_PATH,
        component: lazy(async () => ({
          default: (await import('./synthetic-population-settings-screen'))
            .SyntheticPopulationSettingsScreen,
        })),
      },
      {
        path: `${SYNTHETIC_USERS_PATH}/:id`,
        component: lazy(async () => ({
          default: (await import('./synthetic-user-screen'))
            .SyntheticUserScreen,
        })),
      },
      {
        path: `${SYNTHETIC_USERS_PATH}/:id/events`,
        component: lazy(async () => ({
          default: (await import('./synthetic-user-events-screen'))
            .SyntheticUserEventsScreen,
        })),
      },
      {
        path: `${SYNTHETIC_USERS_PATH}/:id/replay`,
        component: lazy(async () => ({
          default: (await import('./synthetic-user-replay-screen'))
            .SyntheticUserReplayScreen,
        })),
      },
      {
        path: `${SYNTHETIC_USERS_PATH}/:id/inspector`,
        component: lazy(async () => ({
          default: (await import('./synthetic-user-inspector-screen'))
            .SyntheticUserInspectorScreen,
        })),
      },
    ],
  });
}
