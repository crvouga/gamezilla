import { defineFeatureClient } from '@libs/feature-client/client';
import { lazy } from 'solid-js';
import { PopulationSettings } from './population-settings';

export const POPULATION_CLIENT = defineFeatureClient({
  name: 'population',
  settings: PopulationSettings,
  routes: [
    {
      path: '/admin/population',
      component: lazy(async () => ({
        default: (await import('./population-screen')).PopulationScreen,
      })),
    },
    {
      path: '/admin/population/config',
      component: lazy(async () => ({
        default: (await import('./population-screen'))
          .PopulationConfigurationScreen,
      })),
    },
    {
      path: '/admin/population/users/:id',
      component: lazy(async () => ({
        default: (await import('./synthetic-user-screen')).SyntheticUserScreen,
      })),
    },
  ],
});
