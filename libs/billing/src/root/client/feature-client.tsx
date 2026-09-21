/** @jsxImportSource solid-js */
/** What billing contributes to a client app: the membership screen. */

import { defineFeatureClient } from '@libs/feature/public/client';

export const BILLING_CLIENT = defineFeatureClient({
  name: 'billing',
  routes: [
    { path: '/more/billing', load: () => import('./routes/more-billing') },
  ],
});
