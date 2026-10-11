import { BillingScreen } from './billing-screen';
/** @jsxImportSource solid-js */
/**
 * What billing contributes to a client app: the membership screen. Nothing
 * about membership reaches the shell's chrome.
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
});
