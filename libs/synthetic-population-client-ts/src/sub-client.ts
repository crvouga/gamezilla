import { defineSubClient } from '@libs/sub-client-ts/client';
import { lazy } from 'solid-js';
import { SyntheticPopulationSettings } from './synthetic-population-settings';

export const SYNTHETIC_POPULATION_CLIENT = defineSubClient({
  name: 'synthetic-population',
  settings: SyntheticPopulationSettings,
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
      path: '/admin/synthetic-population/users/:id',
      component: lazy(async () => ({
        default: (await import('./synthetic-user-screen')).SyntheticUserScreen,
      })),
    },
  ],
});
