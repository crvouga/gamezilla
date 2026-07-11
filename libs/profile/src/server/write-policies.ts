import type {
  WritePolicy,
  WritePolicyRegistry,
} from '@pkgs/sync-engine/server/upload-handler';
import { createWritePolicyRegistry } from '@pkgs/sync-engine/server/upload-handler';
import type { UploadRow } from '@pkgs/sync-engine/shared/upload-batch';

import { ProfileCol, PROFILES_TABLE } from '@libs/db/shared/profile-tables';

import {
  canChangeUsername,
  validateUsername,
} from '../shared/username';

function deny(reason: string): { readonly allowed: false; readonly reason: string } {
  return { allowed: false, reason };
}

function readRowString(
  row: { readonly values?: Readonly<Record<string, unknown>> },
  column: string
): string | undefined {
  const raw = row.values?.[column];
  return typeof raw === 'string' ? raw : undefined;
}

function validateProfileUsernameWrite(
  row: Parameters<WritePolicy>[1]
): { readonly allowed: false; readonly reason: string } | null {
  const username = readRowString(row, ProfileCol.username);
  if (username === undefined || username.length === 0) return null;
  const error = validateUsername(username);
  if (error !== null) {
    return deny(`profile username ${error}`);
  }
  const changedAt = readRowString(row, ProfileCol.usernameChangedAt);
  if (changedAt !== undefined && !canChangeUsername(changedAt)) {
    return deny('profile username change cooldown');
  }
  return null;
}

export const profilesWritePolicy: WritePolicy = (ctx, row) => {
  if (row.id !== ctx.myId) {
    return deny('profile id mismatch');
  }
  const usernameError = validateProfileUsernameWrite(row);
  if (usernameError !== null) return usernameError;
  return { allowed: true };
};

export const PROFILE_WRITE_POLICIES: Readonly<Record<string, WritePolicy>> = {
  [PROFILES_TABLE.tableName]: profilesWritePolicy,
};

export function createProfileWritePolicyRegistry(): WritePolicyRegistry {
  return createWritePolicyRegistry(PROFILE_WRITE_POLICIES);
}

export function assertProfileWrite(row: UploadRow): void {
  void row;
}
