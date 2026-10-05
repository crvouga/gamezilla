import { defineFeatureClient } from '@libs/feature-client/client';
import { PrivacyScreen } from './privacy-screen';

export const ACCOUNT_PRIVACY_CLIENT = defineFeatureClient({
  name: 'account-privacy',
  routes: [
    {
      path: '/profile/privacy',
      component: PrivacyScreen,
    },
    {
      path: '/profile/privacy/export/:accountId',
      component: PrivacyScreen,
    },
  ],
});
