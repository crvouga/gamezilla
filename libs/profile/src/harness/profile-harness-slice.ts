import type { HarnessSlice } from '@libs/harness/slices';

import { PROFILE_CLIENT } from '../root/client/feature-client';
import { PROFILE_FEATURE } from '../root/feature';
import { PROFILE_HARNESS_ACTIONS } from './profile-actions';

/** Profile in a harness: the Profile tab, username + avatar editing. */
export const PROFILE_HARNESS_SLICE: HarnessSlice = {
  name: 'profile',
  feature: PROFILE_FEATURE,
  client: PROFILE_CLIENT,
  actions: PROFILE_HARNESS_ACTIONS,
};
