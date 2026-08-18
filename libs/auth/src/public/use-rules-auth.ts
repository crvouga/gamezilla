import type { AppRulesAuth } from '../shared/app-rules-auth';
import { mapAppAuthToRulesAuth } from '../shared/map-app-auth-to-rules-auth';
import {
  useIsAnon,
  useMyAccountId,
  useMyDeviceId,
  useMyId,
} from './use-current-user';

export function useRulesAuth(): AppRulesAuth {
  const deviceId = useMyDeviceId();
  const accountId = useMyAccountId();
  const myId = useMyId();
  const isAnon = useIsAnon();
  return mapAppAuthToRulesAuth({ deviceId, accountId, myId, isAnon });
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
  });
}
