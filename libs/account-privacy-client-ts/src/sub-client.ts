import { defineSubClient } from '@libs/sub-client-ts/client';
import { PrivacyScreen } from './privacy-screen';

export const ACCOUNT_PRIVACY_CLIENT = defineSubClient({
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
