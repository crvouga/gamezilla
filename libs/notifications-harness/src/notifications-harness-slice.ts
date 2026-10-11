import type { HarnessSlice } from '@libs/harness/slices';

import { NOTIFICATIONS_CLIENT } from '@libs/notifications-client/sub-client';
import { NOTIFICATIONS_SERVER } from '@libs/notifications-server/sub-server';
import { NOTIFICATIONS_SUB } from '@libs/notifications-shared/sub';
import { NOTIFICATIONS_HARNESS_ACTIONS } from './notifications-actions';

/** The inbox in a harness; it renders whatever sources the composition registers. */
export const NOTIFICATIONS_HARNESS_SLICE: HarnessSlice = {
  name: 'notifications',
  sub: NOTIFICATIONS_SUB,
  client: NOTIFICATIONS_CLIENT,
  server: () => NOTIFICATIONS_SERVER,
  actions: NOTIFICATIONS_HARNESS_ACTIONS,
};
