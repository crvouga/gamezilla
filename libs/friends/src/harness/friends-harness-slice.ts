import type { HarnessSlice } from '@libs/harness/slices';
import { FRIENDS_CLIENT } from '../root/client/feature-client';
import { FRIENDS_FEATURE } from '../root/feature';
import { FRIENDS_SERVER } from '../root/server/feature-server';
import {
  openDeletedProfile,
  prepareOldDevice,
  tryDeletedDeviceJoin,
} from './deleted-device';
import { FRIENDS_HARNESS_ACTIONS } from './friends-actions';
import { PERSON_HARNESS_ACTIONS } from './person-actions';
import { acceptShownRequest, keepShownRequest } from './privacy-actions';

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
  ],
};
