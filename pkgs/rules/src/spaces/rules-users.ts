import { fail } from '../core/fail';
import { defineRule } from '../core/define-rule';
import type { Failure, RulesCtx } from '../core/types';
import type { UploadRow } from '@pkgs/sync-engine/shared/upload-batch';
import { decideSpaceJoinAccess } from './decide-join';
import {
  SPACE_ENDED,
  SPACE_HOST_REQUIRED,
  SPACE_INVALID_INPUT,
  SPACE_NOT_FOUND,
  SPACE_NOT_SIGNED_IN,
} from './codes';
import { decideEndSpace, isSpaceHostActor } from './host-actor';
import {
  querySpaceById,
  readStringValue,
  resolveHostMemberId,
  SPACE_USERS_TABLE,
  spaceIdFromUsersRowId,
  spaceUserExists,
} from './query';

async function failIfNotHost(
  ctx: RulesCtx,
  spaceId: string,
  rowId: string
): Promise<Failure | null> {
  const space = await querySpaceById(ctx.db, spaceId);
  if (space === null) {
    return fail(SPACE_NOT_FOUND, { table: SPACE_USERS_TABLE, id: rowId });
  }
  const hostMemberId = resolveHostMemberId(space);
  if (hostMemberId === null) {
    return fail(SPACE_NOT_FOUND, { table: SPACE_USERS_TABLE, id: rowId });
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
    table: SPACE_USERS_TABLE,
    id: rowId,
    params: { message: 'Only the host can manage space users' },
  });
}

type SelfGrantArgs = {
  readonly ctx: RulesCtx;
  readonly spaceId: string;
  readonly rowId: string;
  readonly createdBy: string | undefined;
  readonly op: string;
};

async function checkSelfGrant(args: SelfGrantArgs): Promise<Failure | null> {
  const { ctx, spaceId, rowId, createdBy, op } = args;
  const space = await querySpaceById(ctx.db, spaceId);
  if (space === null) {
    if (op === 'delete') {
      return fail(SPACE_NOT_FOUND, { table: SPACE_USERS_TABLE, id: rowId });
    }
    if (createdBy !== ctx.auth.accountId) {
      return fail(SPACE_NOT_FOUND, { table: SPACE_USERS_TABLE, id: rowId });
    }
    return null;
  }
  if (space.ended_at !== null) {
    return fail(SPACE_ENDED, { table: SPACE_USERS_TABLE, id: rowId });
  }
  const hostMemberId = resolveHostMemberId(space);
  if (hostMemberId === null) {
    return fail(SPACE_NOT_FOUND, { table: SPACE_USERS_TABLE, id: rowId });
  }
  const accountId = ctx.auth.accountId!;
  const hasSpaceUser = await spaceUserExists(ctx.db, spaceId, accountId);
  const decision = decideSpaceJoinAccess({
    visibility: space.visibility === 'public' ? 'public' : 'private',
    hostId: space.host_id ?? '',
    hostAccountId: space.host_account_id,
    hostMemberId,
    viewerAccountId: accountId,
    viewerDeviceId: ctx.auth.deviceId,
    viewerMemberId: accountId,
    hasSpaceUser,
  });
  if (decision.allowed) return null;
  return fail(decision.code, { table: SPACE_USERS_TABLE, id: rowId });
}

function invalidUsersInput(rowId: string, message: string): Failure {
  return fail(SPACE_INVALID_INPUT, {
    table: SPACE_USERS_TABLE,
    id: rowId,
    params: { message },
  });
}

function resolveSpaceId(row: UploadRow): string | null {
  return readStringValue(row.values, 'space_id') ?? spaceIdFromUsersRowId(row.id);
}

async function checkOneSpaceUserRow(
  ctx: RulesCtx,
  row: UploadRow
): Promise<Failure | null> {
  const accountId = ctx.auth.accountId;
  if (accountId === null || accountId.length === 0) {
    return fail(SPACE_NOT_SIGNED_IN, { table: SPACE_USERS_TABLE, id: row.id });
  }
  const spaceId = resolveSpaceId(row);
  if (spaceId === null || spaceId.length === 0) {
    return invalidUsersInput(row.id, 'Invalid space_users row id');
  }
  const userId = readStringValue(row.values, 'user_id');
  if (userId === undefined || userId.length === 0) {
    return failIfNotHost(ctx, spaceId, row.id);
  }
  if (row.id !== `${spaceId}:${userId}`) {
    return invalidUsersInput(row.id, 'space_users id must match space + user');
  }
  if (userId === accountId && row.op !== 'delete') {
    return checkSelfGrant({
      ctx,
      spaceId,
      rowId: row.id,
      createdBy: readStringValue(row.values, 'created_by_account_id'),
      op: row.op,
    });
  }
  return failIfNotHost(ctx, spaceId, row.id);
}

async function checkSpaceUsers(ctx: RulesCtx): Promise<readonly Failure[]> {
  const failures: Failure[] = [];
  for (const row of ctx.batch.rows) {
    if (row.table !== SPACE_USERS_TABLE) continue;
    const failure = await checkOneSpaceUserRow(ctx, row);
    if (failure !== null) failures.push(failure);
  }
  return failures;
}

export const spaceUsersBeforeRule = defineRule({
  name: 'spaces/USERS',
  phase: 'before',
  touches: [SPACE_USERS_TABLE],
  check: checkSpaceUsers,
});

export const spaceUsersAfterRule = defineRule({
  name: 'spaces/USERS',
  phase: 'after',
  touches: [SPACE_USERS_TABLE],
  check: checkSpaceUsers,
});
