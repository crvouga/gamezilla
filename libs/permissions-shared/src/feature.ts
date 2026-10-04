/**
 * The permissions feature's manifest — everything the composition root needs to
 * fold this bounded context into an app, and the only thing about permissions
 * that anything outside it may depend on.
 */

import { defineFeature } from '@libs/feature-shared/manifest';
import { PERMISSIONS_PRIVACY } from './account-privacy';
import { PERMISSIONS_QUERIES } from './queries';
import { PERMISSIONS_TABLES } from './tables';
import { PERMISSIONS_TOPIC_MAP } from './topic-map';

export const PERMISSIONS_FEATURE = defineFeature({
  name: 'permissions',
  accountPrivacy: PERMISSIONS_PRIVACY,
  tables: PERMISSIONS_TABLES,
  topicMap: PERMISSIONS_TOPIC_MAP,
  // Held open for the whole session: what keeps this feature's slice
  // of the local database warm.
  sessionQueries: ['permissionQuotaLedger'],
  queries: PERMISSIONS_QUERIES,
  mutations: async () => (await import('./mutations')).PERMISSIONS_MUTATIONS,
});
