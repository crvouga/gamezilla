import { defineSubClient, type SubClient } from '@libs/sub-client-ts/client';
import { createComponent, type JSX, lazy } from 'solid-js';
import { type GameName, GameNamesProvider } from './game-names';
import { LiveSessionReporter } from './live-session-reporter';
import { SyntheticPopulationSettings } from './synthetic-population-settings';

/**
 * The Bot Observatory and every app's online-now report. Games depend on
 * the platform, so the composition root hands in the registered games'
 * names, which the Observatory shows wherever it names a game.
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
    settings: SyntheticPopulationSettings,
    // Every app reports that it is online now, a person's or a Synthetic User's.
    session: LiveSessionReporter,
    routes: [
      {
        path: '/admin/synthetic-population',
        component: lazy(async () => ({
          default: (await import('./synthetic-population-screen'))
            .SyntheticPopulationScreen,
        })),
      },
      {
        path: '/admin/synthetic-population/config',
        component: lazy(async () => ({
          default: (await import('./synthetic-population-screen'))
            .SyntheticPopulationConfigurationScreen,
        })),
      },
      {
        path: '/admin/synthetic-population/control',
        component: lazy(async () => ({
          default: (await import('./synthetic-population-screen'))
            .SyntheticPopulationControlScreen,
        })),
      },
      {
        path: '/admin/synthetic-population/live/:sessionId',
        component: lazy(async () => ({
          default: (await import('./live-watch-screen')).LiveWatchScreen,
        })),
      },
      {
        path: '/admin/synthetic-population/users/:id',
        component: lazy(async () => ({
          default: (await import('./synthetic-user-screen'))
            .SyntheticUserScreen,
        })),
      },
    ],
  });
}
