import type { HarnessSlice } from '@libs/harness/slices';

import { SEARCH_CLIENT } from '../root/client/feature-client';
import { SEARCH_HARNESS_ACTIONS } from './search-actions';
import { searchDoesNotHang } from './search-properties';

/** People search in a harness: the Search tab, and a check it never hangs. */
export const SEARCH_HARNESS_SLICE: HarnessSlice = {
  name: 'search',
  client: SEARCH_CLIENT,
  actions: SEARCH_HARNESS_ACTIONS,
  properties: [searchDoesNotHang],
};
