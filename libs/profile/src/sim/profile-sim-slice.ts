import type { SimSlice } from '@libs/sim-harness/slices';

import { PROFILE_CLIENT } from '../root/client/feature-client';
import { PROFILE_FEATURE } from '../root/feature';
import { PROFILE_SIM_ACTIONS } from './profile-actions';
import { PROFILE_WALK_ACTIONS } from './profile-walk';

/** Profile in a sim: the Profile tab, username + avatar editing. */
export const PROFILE_SIM_SLICE: SimSlice = {
  name: 'profile',
  feature: PROFILE_FEATURE,
  client: PROFILE_CLIENT,
  actions: [...PROFILE_SIM_ACTIONS, ...PROFILE_WALK_ACTIONS],
};
