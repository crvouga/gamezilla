import type { HarnessSlice } from '@libs/harness/slices';

import { NOTIFICATIONS_CLIENT } from '../root/client/feature-client';
import { NOTIFICATIONS_FEATURE } from '../root/feature';
import { NOTIFICATIONS_SERVER } from '../root/server/feature-server';
import { NOTIFICATIONS_HARNESS_ACTIONS } from './notifications-actions';

/** The inbox in a harness; it renders whatever sources the composition registers. */
export const NOTIFICATIONS_HARNESS_SLICE: HarnessSlice = {
  name: 'notifications',
  feature: NOTIFICATIONS_FEATURE,
  client: NOTIFICATIONS_CLIENT,
  server: () => NOTIFICATIONS_SERVER,
  actions: NOTIFICATIONS_HARNESS_ACTIONS,
};
