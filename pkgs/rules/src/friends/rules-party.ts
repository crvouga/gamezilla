import { fail } from '../core/fail';
import { defineRule } from '../core/define-rule';
import type { Failure, RulesCtx } from '../core/types';
import type { UploadRow } from '@pkgs/sync-engine/shared/upload-batch';
import {
  FRIENDS_BLOCK_OWNER_MISMATCH,
  FRIENDS_FORBIDDEN,
  FRIENDS_FRIENDSHIP_PARTY_REQUIRED,
  FRIENDS_NOT_FOUND,
  FRIENDS_NOT_SIGNED_IN,
  FRIENDS_REQUEST_PARTY_REQUIRED,
  FRIENDS_SELF,
} from './codes';
import {
  findRequestById,
  FRIEND_REQUESTS_TABLE,
  FRIENDSHIPS_TABLE,
  readStringValue,
  USER_BLOCKS_TABLE,
} from './query';

function requireSignedIn(ctx: RulesCtx, table: string, id: string): Failure | null {
  if (ctx.auth.accountId === null) {
    return fail(FRIENDS_NOT_SIGNED_IN, { table, id });
  }
  return null;
}

function statusPartyFailure(
  status: string | undefined,
  existing: { readonly from_user_id: string; readonly to_user_id: string },
  myId: string,
  rowId: string
): Failure | null {
  if (status === 'accepted' && existing.to_user_id !== myId) {
    return fail(FRIENDS_FORBIDDEN, {
      table: FRIEND_REQUESTS_TABLE,
      id: rowId,
      params: { message: 'Cannot accept this request' },
    });
  }
  if (status === 'declined' && existing.to_user_id !== myId) {
    return fail(FRIENDS_FORBIDDEN, {
      table: FRIEND_REQUESTS_TABLE,
      id: rowId,
      params: { message: 'Cannot decline this request' },
    });
  }
  if (status === 'cancelled' && existing.from_user_id !== myId) {
    return fail(FRIENDS_FORBIDDEN, {
      table: FRIEND_REQUESTS_TABLE,
      id: rowId,
      params: { message: 'Cannot cancel this request' },
    });
  }
  return null;
}

async function checkOneRequestRow(
  ctx: RulesCtx,
  row: UploadRow
): Promise<Failure | null> {
  const signedIn = requireSignedIn(ctx, FRIEND_REQUESTS_TABLE, row.id);
  if (signedIn !== null) return signedIn;
  const fromUserId = readStringValue(row.values, 'from_user_id');
  const toUserId = readStringValue(row.values, 'to_user_id');
  if (fromUserId === ctx.auth.myId || toUserId === ctx.auth.myId) {
    return null;
  }
  const existing = await findRequestById(ctx.db, row.id);
  if (existing === null) {
    if (row.op === 'put') return null;
    return fail(FRIENDS_NOT_FOUND, {
      table: FRIEND_REQUESTS_TABLE,
      id: row.id,
      params: { message: 'Friend request not found' },
    });
  }
  if (
    existing.from_user_id !== ctx.auth.myId &&
    existing.to_user_id !== ctx.auth.myId
  ) {
    return fail(FRIENDS_REQUEST_PARTY_REQUIRED, {
      table: FRIEND_REQUESTS_TABLE,
      id: row.id,
    });
  }
  return statusPartyFailure(
    readStringValue(row.values, 'status'),
    existing,
    ctx.auth.myId,
    row.id
  );
}

async function checkRequestParty(ctx: RulesCtx): Promise<readonly Failure[]> {
  const failures: Failure[] = [];
  for (const row of ctx.batch.rows) {
    if (row.table !== FRIEND_REQUESTS_TABLE) continue;
    const failure = await checkOneRequestRow(ctx, row);
    if (failure !== null) failures.push(failure);
  }
  return failures;
}

function checkOneFriendshipRow(ctx: RulesCtx, row: UploadRow): Failure | null {
  const signedIn = requireSignedIn(ctx, FRIENDSHIPS_TABLE, row.id);
  if (signedIn !== null) return signedIn;
  const userLow = readStringValue(row.values, 'user_low');
  const userHigh = readStringValue(row.values, 'user_high');
  if (userLow === ctx.auth.myId || userHigh === ctx.auth.myId) return null;
  const parts = row.id.split(':');
  if (parts[0] === ctx.auth.myId || parts[1] === ctx.auth.myId) return null;
  return fail(FRIENDS_FRIENDSHIP_PARTY_REQUIRED, {
    table: FRIENDSHIPS_TABLE,
    id: row.id,
  });
}

async function checkFriendshipParty(
  ctx: RulesCtx
): Promise<readonly Failure[]> {
  const failures: Failure[] = [];
  for (const row of ctx.batch.rows) {
    if (row.table !== FRIENDSHIPS_TABLE) continue;
    const failure = checkOneFriendshipRow(ctx, row);
    if (failure !== null) failures.push(failure);
  }
  return failures;
}

function checkOneBlockRow(ctx: RulesCtx, row: UploadRow): Failure | null {
  const signedIn = requireSignedIn(ctx, USER_BLOCKS_TABLE, row.id);
  if (signedIn !== null) return signedIn;
  const blockerId = readStringValue(row.values, 'blocker_id');
  const blockedId = readStringValue(row.values, 'blocked_id');
  if (blockedId === ctx.auth.myId && blockerId === ctx.auth.myId) {
    return fail(FRIENDS_SELF, {
      table: USER_BLOCKS_TABLE,
      id: row.id,
      params: { message: 'Cannot block yourself' },
    });
  }
  if (blockerId !== undefined && blockerId !== ctx.auth.myId) {
    return fail(FRIENDS_BLOCK_OWNER_MISMATCH, {
      table: USER_BLOCKS_TABLE,
      id: row.id,
    });
  }
  return null;
}

async function checkBlockOwner(ctx: RulesCtx): Promise<readonly Failure[]> {
  const failures: Failure[] = [];
  for (const row of ctx.batch.rows) {
    if (row.table !== USER_BLOCKS_TABLE) continue;
    const failure = checkOneBlockRow(ctx, row);
    if (failure !== null) failures.push(failure);
  }
  return failures;
}

export const friendsRequestPartyBeforeRule = defineRule({
  name: 'friends/REQUEST_PARTY',
  phase: 'before',
  touches: [FRIEND_REQUESTS_TABLE],
  check: checkRequestParty,
});

export const friendsRequestPartyAfterRule = defineRule({
  name: 'friends/REQUEST_PARTY',
  phase: 'after',
  touches: [FRIEND_REQUESTS_TABLE],
  check: checkRequestParty,
});

export const friendsFriendshipPartyBeforeRule = defineRule({
  name: 'friends/FRIENDSHIP_PARTY',
  phase: 'before',
  touches: [FRIENDSHIPS_TABLE],
  check: checkFriendshipParty,
});

export const friendsFriendshipPartyAfterRule = defineRule({
  name: 'friends/FRIENDSHIP_PARTY',
  phase: 'after',
  touches: [FRIENDSHIPS_TABLE],
  check: checkFriendshipParty,
});

export const friendsBlockOwnerBeforeRule = defineRule({
  name: 'friends/BLOCK_OWNER',
  phase: 'before',
  touches: [USER_BLOCKS_TABLE],
  check: checkBlockOwner,
});

export const friendsBlockOwnerAfterRule = defineRule({
  name: 'friends/BLOCK_OWNER',
  phase: 'after',
  touches: [USER_BLOCKS_TABLE],
  check: checkBlockOwner,
});
