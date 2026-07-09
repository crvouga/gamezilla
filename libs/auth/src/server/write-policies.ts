import type { AppAuth } from '@libs/auth/shared/auth-context';
import {
  AccountProviderCol,
  ACCOUNTS_TABLE,
  ACCOUNT_PROVIDERS_TABLE,
  ACCOUNT_SESSIONS_TABLE,
  DEVICES_TABLE,
} from '@libs/auth/shared/auth-tables';
import type {
  WritePolicy,
  WritePolicyContext,
  WritePolicyRegistry,
} from '@pkgs/sync-engine/server/upload-handler';
import { createWritePolicyRegistry } from '@pkgs/sync-engine/server/upload-handler';
import type { UploadRow } from '@pkgs/sync-engine/shared/upload-batch';

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

function readString(values: Readonly<Record<string, unknown>>, key: string): string | null {
  const raw = values[key];
  return typeof raw === 'string' && raw.length > 0 ? raw : null;
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

const accountWritePolicy: WritePolicy = (ctx, row) => {
  if (ctx.accountId === null) {
    return reject('account writes require sign-in');
  }
  if (row.id !== ctx.accountId) {
    return reject('account id mismatch');
  }
  return { allowed: true };
};

const accountSessionWritePolicy: WritePolicy = () =>
  reject('account_sessions is server-managed');

const accountProviderWritePolicy: WritePolicy = (ctx, row) => {
  if (ctx.accountId === null) {
    return reject('account_providers require sign-in');
  }
  if (row.op === 'delete') {
    return { allowed: true };
  }
  const values = row.values ?? {};
  const accountId = readString(values, AccountProviderCol.accountId);
  if (accountId !== null && accountId !== ctx.accountId) {
    return reject('account_providers account_id mismatch');
  }
  return { allowed: true };
};

export const AUTH_WRITE_POLICIES: Readonly<Record<string, WritePolicy>> = {
  [DEVICES_TABLE.tableName]: deviceWritePolicy,
  [ACCOUNTS_TABLE.tableName]: accountWritePolicy,
  [ACCOUNT_SESSIONS_TABLE.tableName]: accountSessionWritePolicy,
  [ACCOUNT_PROVIDERS_TABLE.tableName]: accountProviderWritePolicy,
};

export function createAuthWritePolicyRegistry(): WritePolicyRegistry {
  return createWritePolicyRegistry(AUTH_WRITE_POLICIES);
}

export function assertAccountSessionClientWrite(row: UploadRow): never {
  void row;
  throw new Error('account_sessions is server-managed');
}
