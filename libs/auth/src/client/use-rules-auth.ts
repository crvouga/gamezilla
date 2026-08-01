import type { RulesAuth } from '@pkgs/rules/core/types';

import { mapAppAuthToRulesAuth } from '../shared/map-app-auth-to-rules-auth';
import { useMyAccountId, useMyDeviceId, useMyId } from './use-current-user';

export function useRulesAuth(
  memberOfSpaceIds: readonly string[] = []
): RulesAuth {
  const deviceId = useMyDeviceId();
  const accountId = useMyAccountId();
  const myId = useMyId();
  return mapAppAuthToRulesAuth(
    { deviceId, accountId, myId },
    memberOfSpaceIds
  );
}

export function buildRulesAuth(args: {
  readonly deviceId: string;
  readonly accountId: string | null;
  readonly myId: string;
  readonly memberOfSpaceIds?: readonly string[];
}): RulesAuth {
  return mapAppAuthToRulesAuth(
    {
      deviceId: args.deviceId,
      accountId: args.accountId,
      myId: args.myId,
    },
    args.memberOfSpaceIds ?? []
  );
}

/** @deprecated Use {@link useRulesAuth}. */
export const useWriteContext = useRulesAuth;

/** @deprecated Use {@link buildRulesAuth}. */
export const buildWriteContext = buildRulesAuth;
