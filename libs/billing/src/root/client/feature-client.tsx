/** @jsxImportSource solid-js */
/**
 * What billing contributes to a client app: the membership screen, and the
 * plan chip in the global menu.
 */

import { defineFeatureClient } from '@libs/feature/public/client';

export const BILLING_CLIENT = defineFeatureClient({
  name: 'billing',
  routes: [
    { path: '/more/billing', load: () => import('./routes/more-billing') },
  ],
  session: () => import('./session-provider'),
});
