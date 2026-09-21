/**
 * The client-config feature's manifest — everything the composition root needs to
 * fold this bounded context into an app, and the only thing about client-config
 * that anything outside it may depend on.
 */

import { defineFeature } from '@libs/feature/public/manifest';

import { CLIENT_CONFIG_TABLES } from '../public/schema';
import { CLIENT_CONFIG_TOPIC_MAP } from '../public/topic-map';
import { CLIENT_CONFIG_QUERIES } from './queries';

export const CLIENT_CONFIG_FEATURE = defineFeature({
  name: 'client-config',
  tables: CLIENT_CONFIG_TABLES,
  topicMap: CLIENT_CONFIG_TOPIC_MAP,
  queries: CLIENT_CONFIG_QUERIES,
  // No writes: this feature's rows are server-materialized.
  mutations: () => Promise.resolve([]),
});
