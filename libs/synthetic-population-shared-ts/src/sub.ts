import { defineSub } from '@libs/sub-shared-ts/manifest';
import {
  myLiveWatches,
  SYNTHETIC_POPULATION_TOPIC_MAP,
} from './live-watch-query';
import { SYNTHETIC_POPULATION_TABLES } from './tables';

/**
 * Administration uses authenticated Hono RPC; no telemetry is synced to
 * players. The one synced row tells an app it is being watched live.
 */
export const SYNTHETIC_POPULATION_SUB = defineSub({
  name: 'synthetic-population',
  tables: SYNTHETIC_POPULATION_TABLES,
  topicMap: SYNTHETIC_POPULATION_TOPIC_MAP,
  queries: [myLiveWatches],
  sessionQueries: ['myLiveWatches'],
  mutations: async () => [],
});
