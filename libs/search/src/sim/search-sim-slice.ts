import type { SimSlice } from '@libs/sim-harness/slices';

import { SEARCH_CLIENT } from '../root/client/feature-client';
import { SEARCH_SIM_ACTIONS } from './search-actions';
import { searchDoesNotHang } from './search-properties';

/** People search in a sim: the Search tab, and a check it never hangs. */
export const SEARCH_SIM_SLICE: SimSlice = {
  name: 'search',
  client: SEARCH_CLIENT,
  actions: SEARCH_SIM_ACTIONS,
  properties: [searchDoesNotHang],
};
