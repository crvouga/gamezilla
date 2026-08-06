import { fail } from '@pkgs/rules/core/fail';
import { defineRule } from '@pkgs/rules/core/define-rule';
import type { AppRulesAuth } from '@libs/auth/shared/app-rules-auth';
import {
  decideEndSpace,
  isSpaceHostActor,
} from '@libs/spaces/shared/participation/space-participation-policy';
import type { Failure, RulesCtx } from '@pkgs/rules/core/types';
import type { UploadRow } from '@pkgs/sync-engine/shared/upload-batch';
import {
  SPACE_DELETE_DENIED,
  SPACE_HOST_REQUIRED,
  SPACE_NOT_FOUND,
  SPACE_NOT_SIGNED_IN,
  SPACE_WRITE_DENIED,
} from './codes';
import { querySpaceById, resolveHostMemberId, SPACES_TABLE } from './query';

function requireAccount(
  ctx: RulesCtx<AppRulesAuth>,
  row: UploadRow
): Failure | null {
  if (
    ctx.auth.accountId === null ||
    ctx.auth.accountId.length === 0 ||
    ctx.auth.isAnon
  ) {
    return fail(SPACE_NOT_SIGNED_IN, { table: SPACES_TABLE, id: row.id });
  }
  return null;
}

async function failIfNotHostPatch(
  ctx: RulesCtx<AppRulesAuth>,
  row: UploadRow
): Promise<Failure | null> {
  const space = await querySpaceById(ctx.db, row.id);
  if (space === null) return null;
  const hostMemberId = resolveHostMemberId(space);
  if (hostMemberId === null) {
    return fail(SPACE_NOT_FOUND, { table: SPACES_TABLE, id: row.id });
  }
  const accountId = ctx.auth.accountId!;
  const decision = decideEndSpace({
    isHostActor: isSpaceHostActor({
      hostId: space.host_id ?? '',
      hostMemberId,
      hostAccountId: space.host_account_id,
      memberId: accountId,
      accountId,
      deviceId: ctx.auth.deviceId,
    }),
  });
  if (decision.allowed) return null;
  return fail(SPACE_HOST_REQUIRED, {
    table: SPACES_TABLE,
    id: row.id,
    params: { message: 'Only the host can patch this space' },
  });
}

async function checkOneSpacesRow(
  ctx: RulesCtx<AppRulesAuth>,
  row: UploadRow
): Promise<Failure | null> {
  if (row.op === 'delete') {
    return fail(SPACE_DELETE_DENIED, { table: SPACES_TABLE, id: row.id });
  }
  const signedIn = requireAccount(ctx, row);
  if (signedIn !== null) return signedIn;
  return failIfNotHostPatch(ctx, row);
}

async function checkSpacesHostOrCreate(
  ctx: RulesCtx<AppRulesAuth>
): Promise<readonly Failure[]> {
  const failures: Failure[] = [];
  for (const row of ctx.batch.rows) {
    if (row.table !== SPACES_TABLE) continue;
    const failure = await checkOneSpacesRow(ctx, row);
    if (failure !== null) failures.push(failure);
  }
  return failures;
}

function writeDenied(rowId: string, message: string): Failure {
  return fail(SPACE_WRITE_DENIED, {
    table: SPACES_TABLE,
    id: rowId,
    params: { message },
  });
}

function mismatchCreateHostFields(
  row: UploadRow,
  accountId: string,
  deviceId: string
): Failure | null {
  if (row.values?.['host_id'] !== deviceId) {
    return writeDenied(row.id, 'Only the host device can create a space');
  }
  const hostMemberId =
    row.values?.['host_member_id'] ?? row.values?.['host_account_id'];
  if (hostMemberId !== accountId) {
    return writeDenied(row.id, 'Only the host member can create a space');
  }
  const hostAccountId = row.values?.['host_account_id'];
  if (hostAccountId !== undefined && hostAccountId !== accountId) {
    return writeDenied(row.id, 'host_account_id must match the uploader');
  }
  return null;
}

function checkCreateHostFieldsRow(
  ctx: RulesCtx<AppRulesAuth>,
  row: UploadRow
): Failure | null {
  const accountId = ctx.auth.accountId;
  if (accountId === null || accountId.length === 0) {
    return fail(SPACE_NOT_SIGNED_IN, { table: SPACES_TABLE, id: row.id });
  }
  return mismatchCreateHostFields(row, accountId, ctx.auth.deviceId);
}

async function checkSpacesCreateHostFields(
  ctx: RulesCtx<AppRulesAuth>
): Promise<readonly Failure[]> {
  const failures: Failure[] = [];
  for (const row of ctx.batch.rows) {
    if (row.table !== SPACES_TABLE || row.op !== 'put') continue;
    const failure = checkCreateHostFieldsRow(ctx, row);
    if (failure !== null) failures.push(failure);
  }
  return failures;
}

export const spacesHostBeforeRule = defineRule({
  name: 'spaces/HOST',
  phase: 'before',
  touches: [SPACES_TABLE],
  check: checkSpacesHostOrCreate,
});

export const spacesCreateHostAfterRule = defineRule({
  name: 'spaces/CREATE_HOST_FIELDS',
  phase: 'after',
  touches: [SPACES_TABLE],
  check: checkSpacesCreateHostFields,
});
