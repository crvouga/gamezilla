/**
 * The permissions feature's manifest — everything the composition root needs to
 * fold this bounded context into an app, and the only thing about permissions
 * that anything outside it may depend on.
 */

import { defineFeature } from '@libs/feature/public/manifest';

import { PERMISSIONS_TABLES } from '../public/schema';
import { PERMISSIONS_TOPIC_MAP } from '../public/topic-map';
import { PERMISSIONS_QUERIES } from './queries';

export const PERMISSIONS_FEATURE = defineFeature({
  name: 'permissions',
  tables: PERMISSIONS_TABLES,
  topicMap: PERMISSIONS_TOPIC_MAP,
  // Held open for the whole session: what keeps this feature's slice
  // of the local database warm.
  sessionQueries: ['permissionQuotaLedger'],
  queries: PERMISSIONS_QUERIES,
  mutations: async () => (await import('./mutations')).PERMISSIONS_MUTATIONS,
});
