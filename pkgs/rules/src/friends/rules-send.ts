import { fail } from '../core/fail';
import { defineRule } from '../core/define-rule';
import type { Failure, RulesCtx } from '../core/types';
import type { UploadRow } from '@pkgs/sync-engine/shared/upload-batch';
import {
  FRIENDS_ALREADY_FRIENDS,
  FRIENDS_BLOCKED,
  FRIENDS_COOLDOWN,
  FRIENDS_NOT_SIGNED_IN,
  FRIENDS_REQUEST_EXISTS,
  FRIENDS_SELF,
} from './codes';
import { isResendCooldownActive } from './cooldown';
import {
  findLatestDeclinedBetween,
  findPendingBetween,
  friendshipExists,
  FRIEND_REQUESTS_TABLE,
  isBlockedEitherDirection,
  readStringValue,
} from './query';

function readSendTargets(
  row: UploadRow
): { readonly fromUserId: string; readonly toUserId: string } | null {
  const fromUserId = readStringValue(row.values, 'from_user_id');
  const toUserId = readStringValue(row.values, 'to_user_id');
  const status = readStringValue(row.values, 'status') ?? 'pending';
  if (status !== 'pending') return null;
  if (fromUserId === undefined || toUserId === undefined) return null;
  if (toUserId.length === 0) return null;
  return { fromUserId, toUserId };
}

async function checkSendTargets(
  ctx: RulesCtx,
  row: UploadRow,
  toUserId: string
): Promise<Failure | null> {
  if (await isBlockedEitherDirection(ctx.db, ctx.auth.myId, toUserId)) {
    return fail(FRIENDS_BLOCKED, { table: FRIEND_REQUESTS_TABLE, id: row.id });
  }
  if (await friendshipExists(ctx.db, ctx.auth.myId, toUserId)) {
    return fail(FRIENDS_ALREADY_FRIENDS, {
      table: FRIEND_REQUESTS_TABLE,
      id: row.id,
    });
  }
  const incoming = await findPendingBetween(ctx.db, toUserId, ctx.auth.myId);
  if (incoming !== null) {
    return fail(FRIENDS_REQUEST_EXISTS, {
      table: FRIEND_REQUESTS_TABLE,
      id: row.id,
    });
  }
  const declined = await findLatestDeclinedBetween(
    ctx.db,
    ctx.auth.myId,
    toUserId
  );
  if (declined !== null && isResendCooldownActive(declined.responded_at)) {
    return fail(FRIENDS_COOLDOWN, {
      table: FRIEND_REQUESTS_TABLE,
      id: row.id,
    });
  }
  return null;
}

async function checkOneSendRow(
  ctx: RulesCtx,
  row: UploadRow
): Promise<Failure | null> {
  const targets = readSendTargets(row);
  if (targets === null || targets.fromUserId !== ctx.auth.myId) return null;
  if (ctx.auth.accountId === null) {
    return fail(FRIENDS_NOT_SIGNED_IN, {
      table: FRIEND_REQUESTS_TABLE,
      id: row.id,
    });
  }
  if (targets.toUserId === ctx.auth.myId) {
    return fail(FRIENDS_SELF, {
      table: FRIEND_REQUESTS_TABLE,
      id: row.id,
      params: { message: 'Cannot perform this action on yourself' },
    });
  }
  return checkSendTargets(ctx, row, targets.toUserId);
}

async function checkSendRequest(ctx: RulesCtx): Promise<readonly Failure[]> {
  const failures: Failure[] = [];
  for (const row of ctx.batch.rows) {
    if (row.table !== FRIEND_REQUESTS_TABLE || row.op !== 'put') continue;
    const failure = await checkOneSendRow(ctx, row);
    if (failure !== null) failures.push(failure);
  }
  return failures;
}

export const friendsSendBeforeRule = defineRule({
  name: 'friends/SEND',
  phase: 'before',
  touches: [FRIEND_REQUESTS_TABLE],
  check: checkSendRequest,
});
