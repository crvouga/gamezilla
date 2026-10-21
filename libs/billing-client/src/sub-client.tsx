import { BillingScreen } from './billing-screen';
import { CheckoutReturnProvider } from './checkout-return';
/** @jsxImportSource solid-js */
/**
 * What billing contributes to a client app: the membership screen, and the
 * session's memory of a paid checkout return. Nothing about membership
 * reaches the shell's chrome.
 */

import { defineSubClient } from '@libs/sub-client/client';

export const BILLING_CLIENT = defineSubClient({
  name: 'billing',
  routes: [
    {
      path: '/more/billing',
      component: BillingScreen,
    },
  ],
  session: CheckoutReturnProvider,
});
