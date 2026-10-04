/** @jsxImportSource solid-js */
/**
 * What billing contributes to a client app: the membership screen. Nothing
 * about membership reaches the shell's chrome.
 */

import { defineFeatureClient } from '@libs/feature-client/client';

export const BILLING_CLIENT = defineFeatureClient({
  name: 'billing',
  routes: [
    { path: '/more/billing', load: () =>
        import('./billing-screen').then((m) => ({ default: m.BillingScreen })) },
  ],
});
