import type { SimSlice } from '@libs/sim-harness/slices';

import { FRIENDS_CLIENT } from '../root/client/feature-client';
import { FRIENDS_FEATURE } from '../root/feature';
import { FRIENDS_SERVER } from '../root/server/feature-server';
import { FRIENDS_SIM_ACTIONS } from './friends-actions';

/** Friends in a sim: requests, the list, block / remove, search's pills. */
export const FRIENDS_SIM_SLICE: SimSlice = {
  name: 'friends',
  feature: FRIENDS_FEATURE,
  client: FRIENDS_CLIENT,
  server: () => FRIENDS_SERVER,
  actions: FRIENDS_SIM_ACTIONS,
};
