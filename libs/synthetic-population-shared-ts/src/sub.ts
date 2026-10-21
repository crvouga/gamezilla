import { defineSub } from '@libs/sub-shared-ts/manifest';
import { SYNTHETIC_POPULATION_TABLES } from './tables';

/** Administration uses authenticated Hono RPC; no telemetry is synced to players. */
export const SYNTHETIC_POPULATION_SUB = defineSub({
  name: 'synthetic-population',
  tables: SYNTHETIC_POPULATION_TABLES,
  topicMap: {},
  queries: [],
  mutations: async () => [],
});
