import type { AppAuth } from '@libs/auth/shared/auth-context';
import { DEVICES_TABLE } from '@libs/auth/shared/auth-tables';
import {
  EXTERNAL_ACCOUNTS_TABLE,
  USERS_TABLE,
} from '@libs/auth/shared/external-accounts-tables';
import type {
  WritePolicy,
  WritePolicyContext,
  WritePolicyRegistry,
} from '@pkgs/sync-engine/server/upload-handler';
import { createWritePolicyRegistry } from '@pkgs/sync-engine/server/upload-handler';

export function mapAppAuthToWriteContext(
  auth: AppAuth,
  memberOfSpaceIds: readonly string[] = []
): WritePolicyContext {
  return {
    deviceId: auth.deviceId,
    accountId: auth.accountId,
    myId: auth.myId,
    subjectId: auth.accountId ?? auth.deviceId,
    isAnonymous: auth.accountId === null,
    memberOfSpaceIds,
  };
}

function reject(reason: string): { readonly allowed: false; readonly reason: string } {
  return { allowed: false, reason };
}

const deviceWritePolicy: WritePolicy = (ctx, row) => {
  if (ctx.deviceId.length === 0) {
    return reject('device writes require x-anon-id');
  }
  if (row.id !== ctx.deviceId) {
    return reject('device id mismatch');
  }
  return { allowed: true };
};

const denyServerManaged: WritePolicy = () =>
  reject('server-managed table');

export const AUTH_WRITE_POLICIES: Readonly<Record<string, WritePolicy>> = {
  [DEVICES_TABLE.tableName]: deviceWritePolicy,
  [USERS_TABLE]: denyServerManaged,
  [EXTERNAL_ACCOUNTS_TABLE]: denyServerManaged,
};

export function createAuthWritePolicyRegistry(): WritePolicyRegistry {
  return createWritePolicyRegistry(AUTH_WRITE_POLICIES);
}
