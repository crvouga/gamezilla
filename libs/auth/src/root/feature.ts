/**
 * The auth feature's manifest — everything the composition root needs to
 * fold this bounded context into an app, and the only thing about auth
 * that anything outside it may depend on.
 */

import { defineFeature } from '@libs/feature/public/manifest';

import { AUTH_TABLES } from '../public/schema';
import { AUTH_TOPIC_MAP } from '../public/topic-map';
import { AUTH_QUERIES } from './queries';
import { AUTH_PRIVACY } from '../shared/auth/account-privacy';

export const AUTH_FEATURE = defineFeature({
  name: 'auth',
  accountPrivacy: AUTH_PRIVACY,
  tables: AUTH_TABLES,
  topicMap: AUTH_TOPIC_MAP,
  // Held open for the whole session: what keeps this feature's slice
  // of the local database warm.
  sessionQueries: [
    'ownUser',
    'ownDevices',
    'ownAccountDevices',
    'ownExternalAccounts',
  ],
  queries: AUTH_QUERIES,
  mutations: async () => (await import('./mutations')).AUTH_MUTATIONS,
});
