import { defineFeatureClient } from '@libs/feature-client/client';

export const ACCOUNT_PRIVACY_CLIENT = defineFeatureClient({
  name: 'account-privacy',
  routes: [
    { path: '/profile/privacy', load: () => import('./privacy-screen').then((m) => ({ default: m.PrivacyScreen })) },
    {
      path: '/profile/privacy/export/:accountId',
      load: () => import('./privacy-screen').then((m) => ({ default: m.PrivacyScreen })),
    },
  ],
});
