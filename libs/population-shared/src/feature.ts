import { defineFeature } from '@libs/feature-shared/manifest';
import { POPULATION_TABLES } from './tables';

/** Administration uses authenticated Hono RPC; no telemetry is synced to players. */
export const POPULATION_FEATURE = defineFeature({
  name: 'population',
  tables: POPULATION_TABLES,
  topicMap: {},
  queries: [],
  mutations: async () => [],
});
