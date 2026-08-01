import type { AppAuth } from '@libs/auth/shared/auth-context';
import type { RulesAuth } from '@pkgs/rules/core/types';

export function mapAppAuthToRulesAuth(
  auth: AppAuth,
  memberOfSpaceIds: readonly string[] = []
): RulesAuth {
  return {
    deviceId: auth.deviceId,
    accountId: auth.accountId,
    myId: auth.myId,
    subjectId: auth.accountId ?? auth.deviceId,
    isAnonymous: auth.accountId === null,
    memberOfSpaceIds,
  };
}

/** @deprecated Use {@link mapAppAuthToRulesAuth}. */
export const mapAppAuthToWriteContext = mapAppAuthToRulesAuth;
