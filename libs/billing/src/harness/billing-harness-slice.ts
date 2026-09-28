import type { HarnessSlice } from '@libs/harness/slices';

import { PLUS_MEMBERSHIP_OFFER } from '../public/offer';
import { BILLING_CLIENT } from '../root/client/feature-client';
import { BILLING_FEATURE } from '../root/feature';
import { createBillingServer } from '../root/server/feature-server';
import { BILLING_HARNESS_ACTIONS } from './billing-actions';
import { billingBrowserPage } from './billing-browser-page';

/**
 * Billing in a harness. The offer boots the harness's payment provider node; the
 * server gets the host's adapter to it, exactly as production gets its providers'.
 */
export const BILLING_HARNESS_SLICE: HarnessSlice = {
  name: 'billing',
  feature: BILLING_FEATURE,
  client: BILLING_CLIENT,
  server: (deps) => createBillingServer(deps.billing),
  browserPages: [billingBrowserPage],
  billingOffer: PLUS_MEMBERSHIP_OFFER,
  actions: BILLING_HARNESS_ACTIONS,
};
