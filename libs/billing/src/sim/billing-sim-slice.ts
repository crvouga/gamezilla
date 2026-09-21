import type { SimSlice } from '@libs/sim-harness/slices';

import { BILLING_CLIENT } from '../root/client/feature-client';
import { BILLING_FEATURE } from '../root/feature';
import { createBillingServer } from '../root/server/feature-server';
import { BILLING_SIM_ACTIONS } from './billing-actions';
import { billingBrowserPage } from './billing-browser-page';

/** Billing in a sim, against the host's fake membership provider. */
export const BILLING_SIM_SLICE: SimSlice = {
  name: 'billing',
  feature: BILLING_FEATURE,
  client: BILLING_CLIENT,
  server: (deps) => createBillingServer(deps.billing),
  browserPages: [billingBrowserPage],
  actions: BILLING_SIM_ACTIONS,
};
