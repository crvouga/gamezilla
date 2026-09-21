/**
 * The auth feature's manifest — everything the composition root needs to
 * fold this bounded context into an app, and the only thing about auth
 * that anything outside it may depend on.
 */

import { defineFeature } from '@libs/feature/public/manifest';

import { AUTH_TABLES } from '../public/schema';
import { AUTH_TOPIC_MAP } from '../public/topic-map';
import { AUTH_QUERIES } from './queries';

export const AUTH_FEATURE = defineFeature({
  name: 'auth',
  tables: AUTH_TABLES,
  topicMap: AUTH_TOPIC_MAP,
  queries: AUTH_QUERIES,
  mutations: async () => (await import('./mutations')).AUTH_MUTATIONS,
});
