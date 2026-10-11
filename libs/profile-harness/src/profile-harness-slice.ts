import type { HarnessSlice } from '@libs/harness/slices';

import { PROFILE_CLIENT } from '@libs/profile-client/sub-client';
import { PROFILE_SUB } from '@libs/profile-shared/sub';
import { PROFILE_HARNESS_ACTIONS } from './profile-actions';

/** Profile in a harness: the Profile tab, username + avatar editing. */
export const PROFILE_HARNESS_SLICE: HarnessSlice = {
  name: 'profile',
  sub: PROFILE_SUB,
  client: PROFILE_CLIENT,
  actions: PROFILE_HARNESS_ACTIONS,
};
