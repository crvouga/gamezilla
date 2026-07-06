import { assert } from '@pkgs/assert';
import type { Patch, PatchDb } from '../interface';
import {
  OPEN_PATCHES_DB_CONTEXT,
  PATCH_SYNCED_AT,
  toAttributeState,
} from '../interface';
import { PATCH_CREATED_BY_ID } from '../metadata/patch-metadata';
import { unsyncedPatchesQueryForPush } from './impl-sync-rejected-pushes';

function patchAuthorForIdentityFlush(patch: Patch): string {
  return (
    patch.createdBy ??
    (typeof patch.attributes[PATCH_CREATED_BY_ID] === 'string'
      ? patch.attributes[PATCH_CREATED_BY_ID]
      : '')
  );
}

export async function markPatchesAsAlreadyOnRemote(
  local: PatchDb,
  patchIds: readonly string[]
): Promise<void> {
  if (patchIds.length === 0) return;
  await local.update(
    patchIds.map((patchId) => ({
      patchId,
      attributes: toAttributeState({ [PATCH_SYNCED_AT]: '1' }),
    })),
    OPEN_PATCHES_DB_CONTEXT
  );
}

export async function markAllUnsyncedPatchesForEntityTypeAsAlreadyOnRemote(
  local: PatchDb,
  entityType: string
): Promise<string[]> {
  const [result] = await local.read(
    [unsyncedPatchesQueryForPush()],
    OPEN_PATCHES_DB_CONTEXT
  );
  assert.ok(
    result !== null && result !== undefined,
    'read([query]) must return one result'
  );
  const patchIds = result.patches
    .filter((p) => p.entityType === entityType)
    .map((p) => p.patchId);
  await markPatchesAsAlreadyOnRemote(local, patchIds);
  return patchIds;
}

export async function markUnsyncedPatchesWithCreatedByAsAlreadyOnRemote(
  local: PatchDb,
  createdBy: string
): Promise<string[]> {
  if (createdBy.length === 0) return [];
  const [result] = await local.read(
    [{ on: 'patches' }],
    OPEN_PATCHES_DB_CONTEXT
  );
  assert.ok(
    result !== null && result !== undefined,
    'read([query]) must return one result'
  );
  const patchIds = result.patches
    .filter((patch) => patchAuthorForIdentityFlush(patch) === createdBy)
    .map((patch) => patch.patchId);
  await markPatchesAsAlreadyOnRemote(local, patchIds);
  return patchIds;
}
