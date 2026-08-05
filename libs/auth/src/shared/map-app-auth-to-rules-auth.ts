import type { AppAuth } from '@libs/auth/shared/auth-context';

import type { AppRulesAuth } from './app-rules-auth';

export function mapAppAuthToRulesAuth(auth: AppAuth): AppRulesAuth {
  return {
    userId: auth.myId,
    deviceId: auth.deviceId,
    accountId: auth.accountId,
  };
}
