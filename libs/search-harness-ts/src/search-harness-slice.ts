import type { HarnessSlice } from '@libs/harness-ts/slices';

import { SEARCH_CLIENT } from '@libs/search-client-ts/sub-client';
import { SEARCH_HARNESS_ACTIONS } from './search-actions';
import { searchDoesNotHang } from './search-properties';

/** People search in a harness: the Search tab, and a check it never hangs. */
export const SEARCH_HARNESS_SLICE: HarnessSlice = {
  name: 'search',
  client: SEARCH_CLIENT,
  actions: SEARCH_HARNESS_ACTIONS,
  properties: [searchDoesNotHang],
};
