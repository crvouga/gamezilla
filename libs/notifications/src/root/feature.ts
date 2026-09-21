/**
 * The notifications feature's manifest — everything the composition root needs to
 * fold this bounded context into an app, and the only thing about notifications
 * that anything outside it may depend on.
 */

import { defineFeature } from '@libs/feature/public/manifest';

import { NOTIFICATIONS_TABLES } from '../public/schema';
import { NOTIFICATIONS_TOPIC_MAP } from '../public/topic-map';
import { NOTIFICATIONS_QUERIES } from './queries';

export const NOTIFICATIONS_FEATURE = defineFeature({
  name: 'notifications',
  tables: NOTIFICATIONS_TABLES,
  topicMap: NOTIFICATIONS_TOPIC_MAP,
  // Held open for the whole session: what keeps this feature's slice
  // of the local database warm.
  sessionQueries: ['notificationsActive'],
  queries: NOTIFICATIONS_QUERIES,
  // No writes: this feature's rows are server-materialized.
  mutations: () => Promise.resolve([]),
});
