import type { HarnessSlice } from '@libs/harness/slices';
import { POPULATION_CLIENT } from '@libs/population-client/feature-client';
import { POPULATION_SERVER } from '@libs/population-server/feature-server';
import { POPULATION_FEATURE } from '@libs/population-shared/feature';

export const POPULATION_HARNESS_SLICE: HarnessSlice = {
  name: 'population',
  feature: POPULATION_FEATURE,
  client: POPULATION_CLIENT,
  server: () => POPULATION_SERVER,
};
