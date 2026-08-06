import { fail } from '@pkgs/rules/core/fail';
import { defineRule } from '@pkgs/rules/core/define-rule';
import type { AppRulesAuth } from '@libs/auth/shared/app-rules-auth';
import type { Failure, RulesCtx } from '@pkgs/rules/core/types';
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
  ctx: RulesCtx<AppRulesAuth>,
  row: UploadRow,
  toUserId: string
): Promise<Failure | null> {
  if (await isBlockedEitherDirection(ctx.db, ctx.auth.userId, toUserId)) {
    return fail(FRIENDS_BLOCKED, { table: FRIEND_REQUESTS_TABLE, id: row.id });
  }
  if (await friendshipExists(ctx.db, ctx.auth.userId, toUserId)) {
    return fail(FRIENDS_ALREADY_FRIENDS, {
      table: FRIEND_REQUESTS_TABLE,
      id: row.id,
    });
  }
  const incoming = await findPendingBetween(ctx.db, toUserId, ctx.auth.userId);
  if (incoming !== null) {
    return fail(FRIENDS_REQUEST_EXISTS, {
      table: FRIEND_REQUESTS_TABLE,
      id: row.id,
    });
  }
  const declined = await findLatestDeclinedBetween(
    ctx.db,
    ctx.auth.userId,
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
  ctx: RulesCtx<AppRulesAuth>,
  row: UploadRow
): Promise<Failure | null> {
  const targets = readSendTargets(row);
  if (targets === null || targets.fromUserId !== ctx.auth.userId) return null;
  if (ctx.auth.accountId === null || ctx.auth.isAnon) {
    return fail(FRIENDS_NOT_SIGNED_IN, {
      table: FRIEND_REQUESTS_TABLE,
      id: row.id,
    });
  }
  if (targets.toUserId === ctx.auth.userId) {
    return fail(FRIENDS_SELF, {
      table: FRIEND_REQUESTS_TABLE,
      id: row.id,
      params: { message: 'Cannot perform this action on yourself' },
    });
  }
  return checkSendTargets(ctx, row, targets.toUserId);
}

async function checkSendRequest(
  ctx: RulesCtx<AppRulesAuth>
): Promise<readonly Failure[]> {
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
