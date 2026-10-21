import type { HarnessSlice } from '@libs/harness-ts/slices';

import { NOTIFICATIONS_CLIENT } from '@libs/notifications-client-ts/sub-client';
import { NOTIFICATIONS_SERVER } from '@libs/notifications-server-ts/sub-server';
import { NOTIFICATIONS_SUB } from '@libs/notifications-shared-ts/sub';
import { NOTIFICATIONS_HARNESS_ACTIONS } from './notifications-actions';

/** The inbox in a harness; it renders whatever sources the composition registers. */
export const NOTIFICATIONS_HARNESS_SLICE: HarnessSlice = {
  name: 'notifications',
  sub: NOTIFICATIONS_SUB,
  client: NOTIFICATIONS_CLIENT,
  server: () => NOTIFICATIONS_SERVER,
  actions: NOTIFICATIONS_HARNESS_ACTIONS,
};
