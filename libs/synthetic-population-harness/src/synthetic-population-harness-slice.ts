import type { HarnessSlice } from '@libs/harness/slices';
import { SYNTHETIC_POPULATION_CLIENT } from '@libs/synthetic-population-client/feature-client';
import { SYNTHETIC_POPULATION_SERVER } from '@libs/synthetic-population-server/feature-server';
import { SYNTHETIC_POPULATION_FEATURE } from '@libs/synthetic-population-shared/feature';

export const SYNTHETIC_POPULATION_HARNESS_SLICE: HarnessSlice = {
  name: 'synthetic-population',
  feature: SYNTHETIC_POPULATION_FEATURE,
  client: SYNTHETIC_POPULATION_CLIENT,
  server: () => SYNTHETIC_POPULATION_SERVER,
};
