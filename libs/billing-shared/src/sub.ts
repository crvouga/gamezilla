/**
 * The billing sub's manifest — everything the composition root needs to
 * fold this bounded context into an app, and the only thing about billing
 * that anything outside it may depend on.
 */

import { defineSub } from '@libs/sub-shared/manifest';
import { BILLING_PRIVACY } from './account-privacy';
import { BILLING_QUERIES } from './queries';
import { BILLING_TABLES } from './tables';
import { BILLING_TOPIC_MAP } from './topic-map';

export const BILLING_SUB = defineSub({
  name: 'billing',
  accountPrivacy: BILLING_PRIVACY,
  tables: BILLING_TABLES,
  topicMap: BILLING_TOPIC_MAP,
  // Held open for the whole session: what keeps this sub's slice
  // of the local database warm.
  sessionQueries: ['mySubscription'],
  queries: BILLING_QUERIES,
  // No writes: this sub's rows are server-materialized.
  mutations: () => Promise.resolve([]),
});
