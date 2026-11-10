import { defineSubClient } from '@libs/sub-client-ts/client';
import { lazy } from 'solid-js';
import { LiveSessionReporter } from './live-session-reporter';
import { SyntheticPopulationSettings } from './synthetic-population-settings';

export const SYNTHETIC_POPULATION_CLIENT = defineSubClient({
  name: 'synthetic-population',
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
        default: (await import('./synthetic-user-screen')).SyntheticUserScreen,
      })),
    },
  ],
});
