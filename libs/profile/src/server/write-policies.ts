import type {
  WritePolicy,
  WritePolicyRegistry,
} from '@pkgs/sync-engine/server/upload-handler';
import { createWritePolicyRegistry } from '@pkgs/sync-engine/server/upload-handler';
import type { UploadRow } from '@pkgs/sync-engine/shared/upload-batch';

import { PROFILES_TABLE } from '@libs/db/shared/profile-tables';

function deny(reason: string): { readonly allowed: false; readonly reason: string } {
  return { allowed: false, reason };
}

export const profilesWritePolicy: WritePolicy = (ctx, row) => {
  if (row.id !== ctx.myId) {
    return deny('profile id mismatch');
  }
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
