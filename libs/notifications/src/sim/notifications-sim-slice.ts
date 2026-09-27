import type { SimSlice } from '@libs/sim-harness/slices';

import { NOTIFICATIONS_CLIENT } from '../root/client/feature-client';
import { NOTIFICATIONS_FEATURE } from '../root/feature';
import { NOTIFICATIONS_SERVER } from '../root/server/feature-server';
import { NOTIFICATIONS_SIM_ACTIONS } from './notifications-actions';

/** The inbox in a sim; it renders whatever sources the composition registers. */
export const NOTIFICATIONS_SIM_SLICE: SimSlice = {
  name: 'notifications',
  feature: NOTIFICATIONS_FEATURE,
  client: NOTIFICATIONS_CLIENT,
  server: () => NOTIFICATIONS_SERVER,
  actions: NOTIFICATIONS_SIM_ACTIONS,
};
