import { defineFeatureClient } from '@libs/feature-client/client';
import { PuzzleManagementSettings } from './puzzle-management-settings';

export const PUZZLE_MANAGEMENT_CLIENT = defineFeatureClient({
  name: 'puzzle-management',
  routes: [
    {
      path: '/more/puzzles',
      load: () =>
        import('./puzzle-management-screen').then((module) => ({
          default: module.PuzzleManagementScreen,
        })),
    },
  ],
  settings: PuzzleManagementSettings,
});
