import { defineSub } from '@libs/sub-shared-ts/manifest';
import { myLiveWatches, OBSERVATORY_TOPIC_MAP } from './live-watch-query';
import { OBSERVATORY_TABLES } from './tables';

/**
 * The User Observatory: who is online now and watching them live. Its reads
 * are authenticated Hono RPC; the one synced row tells an app it is being
 * watched live.
 */
export const OBSERVATORY_SUB = defineSub({
  name: 'observatory',
  tables: OBSERVATORY_TABLES,
  topicMap: OBSERVATORY_TOPIC_MAP,
  queries: [myLiveWatches],
  sessionQueries: ['myLiveWatches'],
  mutations: async () => [],
});
