/**
 * The profile feature's manifest — everything the composition root needs to
 * fold this bounded context into an app, and the only thing about profile
 * that anything outside it may depend on.
 */

import { defineFeature } from '@libs/feature/public/manifest';

import { PROFILE_TABLES } from '../public/schema';
import { PROFILE_TOPIC_MAP } from '../public/topic-map';
import { PROFILE_QUERIES } from './queries';

export const PROFILE_FEATURE = defineFeature({
  name: 'profile',
  tables: PROFILE_TABLES,
  topicMap: PROFILE_TOPIC_MAP,
  // Held open for the whole session: what keeps this feature's slice
  // of the local database warm.
  sessionQueries: ['ownProfile'],
  queries: PROFILE_QUERIES,
  mutations: async () => (await import('./mutations')).PROFILE_MUTATIONS,
});
