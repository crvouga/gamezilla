import type { AppAuth } from '@libs/auth/shared/auth-context';
import type { UploadAuth } from '@pkgs/sync-engine/shared/rules-auth';

export function mapAppAuthToUploadAuth(
  auth: AppAuth,
  memberOfSpaceIds: readonly string[] = []
): UploadAuth {
  return {
    userId: auth.myId,
    deviceId: auth.deviceId,
    accountId: auth.accountId,
    isAnon: auth.isAnon,
    memberOfSpaceIds,
  };
}
