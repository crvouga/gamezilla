/**
 * The spaces feature's manifest — everything the composition root needs to
 * fold this bounded context into an app, and the only thing about spaces
 * that anything outside it may depend on.
 */

import { defineFeature } from '@libs/feature/public/manifest';

import { SPACES_TABLES } from '../public/schema';
import { SPACES_TOPIC_MAP } from '../public/topic-map';
import { SPACE_QUERIES } from './queries';

export const SPACES_FEATURE = defineFeature({
  name: 'spaces',
  tables: SPACES_TABLES,
  topicMap: SPACES_TOPIC_MAP,
  queries: SPACE_QUERIES,
  mutations: async () => (await import('./mutations')).SPACE_MUTATIONS,
});
