/**
 * The friends feature's manifest — everything the composition root needs to
 * fold this bounded context into an app, and the only thing about friends
 * that anything outside it may depend on.
 */

import { defineFeature } from '@libs/feature/public/manifest';

import { FRIENDS_TABLES } from '../public/schema';
import { FRIENDS_TOPIC_MAP } from '../public/topic-map';
import { FRIENDS_QUERIES } from './queries';

export const FRIENDS_FEATURE = defineFeature({
  name: 'friends',
  tables: FRIENDS_TABLES,
  topicMap: FRIENDS_TOPIC_MAP,
  // Friend rows are shown with the other person's name and avatar, so the
  // friendship queries join `profile`. Migration target: a profile-card port
  // the composition root fills, so friends stops reading another feature's
  // table directly.
  readsForeign: ['profile'],
  queries: FRIENDS_QUERIES,
  mutations: async () => (await import('./mutations')).FRIENDS_MUTATIONS,
});
