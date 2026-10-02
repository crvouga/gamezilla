import { useIsAnon } from './access-facts';
import type { AppRulesAuth } from './app-rules-auth';
import { mapAppAuthToRulesAuth } from './map-app-auth-to-rules-auth';
import { useMyAccountId, useMyDeviceId, useMyId } from './use-current-user';

export function useRulesAuth(): AppRulesAuth {
  const deviceId = useMyDeviceId();
  const accountId = useMyAccountId();
  const myId = useMyId();
  const isAnon = useIsAnon();
  return {
    get deviceId() {
      return deviceId();
    },
    get accountId() {
      return accountId();
    },
    get userId() {
      return myId();
    },
    get isAnon() {
      return isAnon();
    },
  };
}

export function buildRulesAuth(args: {
  readonly deviceId: string;
  readonly accountId: string | null;
  readonly myId: string;
  readonly isAnon?: boolean;
}): AppRulesAuth {
  return mapAppAuthToRulesAuth({
    deviceId: args.deviceId,
    accountId: args.accountId,
    myId: args.myId,
    isAnon: args.isAnon ?? false,
    authenticatedAtMs: null,
  });
}
