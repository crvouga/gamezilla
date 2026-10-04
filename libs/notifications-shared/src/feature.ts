/**
 * The notifications feature's manifest — everything the composition root needs to
 * fold this bounded context into an app, and the only thing about notifications
 * that anything outside it may depend on.
 */

import { defineFeature } from '@libs/feature-shared/manifest';
import { NOTIFICATIONS_PRIVACY } from './account-privacy';
import { NOTIFICATIONS_QUERIES } from './notifications-active-query';
import { NOTIFICATIONS_TABLES } from './tables';
import { NOTIFICATIONS_TOPIC_MAP } from './topic-map';

export const NOTIFICATIONS_FEATURE = defineFeature({
  name: 'notifications',
  accountPrivacy: NOTIFICATIONS_PRIVACY,
  tables: NOTIFICATIONS_TABLES,
  topicMap: NOTIFICATIONS_TOPIC_MAP,
  // Held open for the whole session: what keeps this feature's slice
  // of the local database warm.
  sessionQueries: ['notificationsActive'],
  queries: NOTIFICATIONS_QUERIES,
  // No writes: this feature's rows are server-materialized.
  mutations: () => Promise.resolve([]),
});
