import type { AppRulesAuth } from '../shared/app-rules-auth';
import { mapAppAuthToRulesAuth } from '../shared/map-app-auth-to-rules-auth';
import { useMyAccountId, useMyDeviceId, useMyId } from './use-current-user';

export function useRulesAuth(): AppRulesAuth {
  const deviceId = useMyDeviceId();
  const accountId = useMyAccountId();
  const myId = useMyId();
  return mapAppAuthToRulesAuth({ deviceId, accountId, myId });
}

export function buildRulesAuth(args: {
  readonly deviceId: string;
  readonly accountId: string | null;
  readonly myId: string;
}): AppRulesAuth {
  return mapAppAuthToRulesAuth({
    deviceId: args.deviceId,
    accountId: args.accountId,
    myId: args.myId,
  });
}

/** @deprecated Use {@link useRulesAuth}. */
export const useWriteContext = useRulesAuth;

/** @deprecated Use {@link buildRulesAuth}. */
export const buildWriteContext = buildRulesAuth;
