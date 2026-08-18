import type { AppAuth } from '@libs/auth/public/auth-context';

import type { AppRulesAuth } from './app-rules-auth';

export function mapAppAuthToRulesAuth(auth: AppAuth): AppRulesAuth {
  return {
    userId: auth.myId,
    deviceId: auth.deviceId,
    accountId: auth.accountId,
    isAnon: auth.isAnon,
  };
}
