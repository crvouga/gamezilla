/**
 * The client-config feature's manifest — everything the composition root needs to
 * fold this bounded context into an app, and the only thing about client-config
 * that anything outside it may depend on.
 */

import { defineFeature } from '@libs/feature-shared/manifest';

import { CLIENT_CONFIG_TABLES } from './tables';
import { CLIENT_CONFIG_TOPIC_MAP } from './topic-map';
import { CLIENT_CONFIG_QUERIES } from './client-config-query';

export const CLIENT_CONFIG_FEATURE = defineFeature({
  name: 'client-config',
  tables: CLIENT_CONFIG_TABLES,
  topicMap: CLIENT_CONFIG_TOPIC_MAP,
  // Held open for the whole session: what keeps this feature's slice
  // of the local database warm.
  sessionQueries: ['clientConfig'],
  queries: CLIENT_CONFIG_QUERIES,
  // No writes: this feature's rows are server-materialized.
  mutations: () => Promise.resolve([]),
});
