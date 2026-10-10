import { PROFILE_MUTATIONS } from './mutations';
/**
 * The profile sub's manifest — everything the composition root needs to
 * fold this bounded context into an app, and the only thing about profile
 * that anything outside it may depend on.
 */

import { defineSub } from '@libs/sub-shared/manifest';
import { PROFILE_PRIVACY } from './profile-privacy';
import { PROFILE_QUERIES } from './queries';
import { PROFILE_TABLES } from './tables';
import { PROFILE_TOPIC_MAP } from './topic-map';

export const PROFILE_SUB = defineSub({
  name: 'profile',
  accountPrivacy: PROFILE_PRIVACY,
  tables: PROFILE_TABLES,
  topicMap: PROFILE_TOPIC_MAP,
  // Held open for the whole session: what keeps this sub's slice
  // of the local database warm.
  sessionQueries: ['ownProfile'],
  queries: PROFILE_QUERIES,
  mutations: async () => PROFILE_MUTATIONS,
});
