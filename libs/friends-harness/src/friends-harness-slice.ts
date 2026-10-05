import { FRIENDS_CLIENT } from '@libs/friends-client/feature-client';
import { FRIENDS_SERVER } from '@libs/friends-server/feature-server';
import { FRIENDS_FEATURE } from '@libs/friends-shared/feature';
import type { HarnessSlice } from '@libs/harness/slices';
import {
  openDeletedProfile,
  prepareOldDevice,
  tryDeletedDeviceJoin,
} from './deleted-device';
import { FRIENDS_HARNESS_ACTIONS } from './friends-actions';
import { PERSON_HARNESS_ACTIONS } from './person-actions';
import { acceptShownRequest, keepShownRequest } from './privacy-actions';
import { setupBlock } from './setup-block';

/** Friends in a harness: requests, the list, block / remove, search's pills. */
export const FRIENDS_HARNESS_SLICE: HarnessSlice = {
  name: 'friends',
  feature: FRIENDS_FEATURE,
  client: FRIENDS_CLIENT,
  server: () => FRIENDS_SERVER,
  actions: [
    ...FRIENDS_HARNESS_ACTIONS,
    keepShownRequest,
    acceptShownRequest,
    prepareOldDevice,
    tryDeletedDeviceJoin,
    openDeletedProfile,
    ...PERSON_HARNESS_ACTIONS,
    setupBlock,
  ],
};
