import type { SimSlice } from '@libs/sim-harness/slices';

import { PLUS_MEMBERSHIP_OFFER } from '../public/offer';
import { BILLING_CLIENT } from '../root/client/feature-client';
import { BILLING_FEATURE } from '../root/feature';
import { createBillingServer } from '../root/server/feature-server';
import { BILLING_SIM_ACTIONS } from './billing-actions';
import { billingBrowserPage } from './billing-browser-page';

/**
 * Billing in a sim. The offer boots the sim's payment provider node; the
 * server gets the host's adapter to it, exactly as production gets its providers'.
 */
export const BILLING_SIM_SLICE: SimSlice = {
  name: 'billing',
  feature: BILLING_FEATURE,
  client: BILLING_CLIENT,
  server: (deps) => createBillingServer(deps.billing),
  browserPages: [billingBrowserPage],
  billingOffer: PLUS_MEMBERSHIP_OFFER,
  actions: BILLING_SIM_ACTIONS,
};
