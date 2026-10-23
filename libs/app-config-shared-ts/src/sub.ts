/**
 * The client-config sub's manifest — everything the composition root needs to
 * fold this bounded context into an app, and the only thing about client-config
 * that anything outside it may depend on.
 */

import { defineSub } from '@libs/sub-shared-ts/manifest';
import { CLIENT_CONFIG_QUERIES } from './client-config-query';
import { CLIENT_CONFIG_TABLES } from './tables';
import { CLIENT_CONFIG_TOPIC_MAP } from './topic-map';

export const CLIENT_CONFIG_SUB = defineSub({
  name: 'client-config',
  tables: CLIENT_CONFIG_TABLES,
  topicMap: CLIENT_CONFIG_TOPIC_MAP,
  // Held open for the whole session: what keeps this sub's slice
  // of the local database warm.
  sessionQueries: ['clientConfig'],
  queries: CLIENT_CONFIG_QUERIES,
  // No writes: this sub's rows are server-materialized.
  mutations: () => Promise.resolve([]),
});
