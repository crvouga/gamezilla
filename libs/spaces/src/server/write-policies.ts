import type {
  WritePolicy,
  WritePolicyRegistry,
} from '@pkgs/sync-engine/server/upload-handler';
import { createWritePolicyRegistry } from '@pkgs/sync-engine/server/upload-handler';

import {
  SPACES_TABLE,
  SPACE_MEMBERSHIPS_TABLE,
} from '../shared/sync-tables';

function readRowString(
  row: { readonly values?: Readonly<Record<string, unknown>> },
  column: string
): string | undefined {
  const raw = row.values?.[column];
  return typeof raw === 'string' ? raw : undefined;
}

function deny(reason: string): { readonly allowed: false; readonly reason: string } {
  return { allowed: false, reason };
}

export const spacesWritePolicy: WritePolicy = (ctx, row) => {
  const hostId = readRowString(row, 'host_id');
  if (hostId !== undefined && hostId !== ctx.myId) {
    return deny('space write denied');
  }
  return { allowed: true };
};

export const spaceMembershipsWritePolicy: WritePolicy = (ctx, row) => {
  const guestId = readRowString(row, 'guest_id');
  if (guestId !== undefined && guestId !== ctx.myId) {
    return deny('space_membership guest_id mismatch');
  }
  return { allowed: true };
};

export const SPACE_WRITE_POLICIES: Readonly<Record<string, WritePolicy>> = {
  [SPACES_TABLE.tableName]: spacesWritePolicy,
  [SPACE_MEMBERSHIPS_TABLE.tableName]: spaceMembershipsWritePolicy,
};

export function createSpaceWritePolicyRegistry(): WritePolicyRegistry {
  return createWritePolicyRegistry(SPACE_WRITE_POLICIES);
}
