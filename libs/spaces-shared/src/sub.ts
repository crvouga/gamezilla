import { SPACE_MUTATIONS } from './mutations';
/**
 * The spaces sub's manifest — everything the composition root needs to
 * fold this bounded context into an app, and the only thing about spaces
 * that anything outside it may depend on.
 */

import { defineSub } from '@libs/sub-shared/manifest';
import { SPACES_PRIVACY } from './account-privacy';
import { SPACE_QUERIES } from './queries';
import { SPACES_TABLES } from './tables';
import { SPACES_TOPIC_MAP } from './topic-map';

export const SPACES_SUB = defineSub({
  name: 'spaces',
  accountPrivacy: SPACES_PRIVACY,
  tables: SPACES_TABLES,
  topicMap: SPACES_TOPIC_MAP,
  // Held open for the whole session: what keeps this sub's slice
  // of the local database warm.
  sessionQueries: ['openSpaceSessions', 'mySpaces', 'mySpaceUsers'],
  queries: SPACE_QUERIES,
  mutations: async () => SPACE_MUTATIONS,
});
