import { BILLING_CLIENT } from '@libs/billing-client/sub-client';
import { createBillingServer } from '@libs/billing-server/sub-server';
import { PLUS_MEMBERSHIP_OFFER } from '@libs/billing-shared/plus-membership-offer';
import { BILLING_SUB } from '@libs/billing-shared/sub';
import type { HarnessSlice } from '@libs/harness/slices';
import {
  agePaymentRetention,
  makeMembershipPayment,
  pauseCancellation,
  paymentAfterDeletion,
  resumeCancellation,
} from './account-privacy';
import { BILLING_HARNESS_ACTIONS } from './billing-actions';

/**
 * Billing in a harness. The offer boots the harness's payment provider node; the
 * server gets the host's adapter to it, exactly as production gets its providers'.
 */
export const BILLING_HARNESS_SLICE: HarnessSlice = {
  name: 'billing',
  sub: BILLING_SUB,
  client: BILLING_CLIENT,
  server: (deps) => createBillingServer(deps.billing),
  billingOffer: PLUS_MEMBERSHIP_OFFER,
  actions: [
    ...BILLING_HARNESS_ACTIONS,
    pauseCancellation,
    resumeCancellation,
    paymentAfterDeletion,
    agePaymentRetention,
    makeMembershipPayment,
  ],
};
