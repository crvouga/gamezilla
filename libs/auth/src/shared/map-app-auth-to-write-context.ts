import type { AppAuth } from '@libs/auth/shared/auth-context';
import type { WriteContext } from '@pkgs/write/shared/write-context';

export function mapAppAuthToWriteContext(
  auth: AppAuth,
  memberOfSpaceIds: readonly string[] = []
): WriteContext {
  return {
    deviceId: auth.deviceId,
    accountId: auth.accountId,
    myId: auth.myId,
    subjectId: auth.accountId ?? auth.deviceId,
    isAnonymous: auth.accountId === null,
    memberOfSpaceIds,
  };
}
