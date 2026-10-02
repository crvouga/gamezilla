import { defineFeatureClient } from '@libs/feature/public/client';

export const ACCOUNT_PRIVACY_CLIENT = defineFeatureClient({
  name: 'account-privacy',
  routes: [
    { path: '/profile/privacy', load: () => import('./routes/privacy') },
    {
      path: '/profile/privacy/export/:accountId',
      load: () => import('./routes/privacy'),
    },
  ],
});
