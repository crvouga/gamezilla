import { PERMISSIONS_MUTATIONS } from './mutations';
/**
 * The permissions sub's manifest — everything the composition root needs to
 * fold this bounded context into an app, and the only thing about permissions
 * that anything outside it may depend on.
 */

import { defineSub } from '@libs/sub-shared/manifest';
import { PERMISSIONS_PRIVACY } from './account-privacy';
import { PERMISSIONS_QUERIES } from './queries';
import { PERMISSIONS_TABLES } from './tables';
import { PERMISSIONS_TOPIC_MAP } from './topic-map';

export const PERMISSIONS_SUB = defineSub({
  name: 'permissions',
  accountPrivacy: PERMISSIONS_PRIVACY,
  tables: PERMISSIONS_TABLES,
  topicMap: PERMISSIONS_TOPIC_MAP,
  // Held open for the whole session: what keeps this sub's slice
  // of the local database warm.
  sessionQueries: ['permissionQuotaLedger'],
  queries: PERMISSIONS_QUERIES,
  mutations: async () => PERMISSIONS_MUTATIONS,
});
