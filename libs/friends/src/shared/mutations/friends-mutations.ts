import { userTopic } from '@libs/db/shared/sync-topics';
import { sql } from '@pkgs/sql';
import {
  defineMutation,
  type MutationDb,
  type MutationEnv,
  MutationError,
} from '@pkgs/sync-engine/shared';
import { z } from 'zod';

import { canonicalUserPair } from '../canonical-pair';
import {
  friendshipExists as friendshipExistsSql,
  softDeleteBlock,
  softDeleteFriendship,
} from '../friends-sql/friendship-block-sql';
import { pairId } from '../pair-id';
import {
  FRIEND_REQUEST_RESEND_COOLDOWN_MS,
  FRIENDS_ALREADY_FRIENDS,
  FRIENDS_BLOCKED,
  FRIENDS_COOLDOWN,
  FRIENDS_FORBIDDEN,
  FRIENDS_NOT_FOUND,
  FRIENDS_NOT_SIGNED_IN,
  FRIENDS_REQUEST_EXISTS,
  FRIENDS_SELF,
} from './friends-mutation-codes';

function friendsPartyInvalidates(env: MutationEnv, otherUserId: string) {
  return [userTopic(env.actorId), userTopic(otherUserId)];
}

type FriendRequestRow = {
  readonly id: string;
  readonly from_user_id: string;
  readonly to_user_id: string;
  readonly status: string;
  readonly responded_at: string | null;
};

const requestIdArgs = z.object({ requestId: z.string().min(1) });
const userIdArgs = z.object({ userId: z.string().min(1) });

function actorId(env: MutationEnv): string {
  if (env.accountId === null || env.isAnon) {
    throw new MutationError(
      FRIENDS_NOT_SIGNED_IN,
      'Sign in to manage friends.'
    );
  }
  return env.actorId;
}

function otherUserId(env: MutationEnv, userId: string, action: string): string {
  const currentActorId = actorId(env);
  if (currentActorId === userId) {
    throw new MutationError(FRIENDS_SELF, `Cannot ${action} yourself.`);
  }
  return currentActorId;
}

function resendCooldownActive(respondedAt: string, now: Date): boolean {
  const respondedMs = Date.parse(respondedAt);
  if (!Number.isFinite(respondedMs)) return false;
  return now.getTime() - respondedMs < FRIEND_REQUEST_RESEND_COOLDOWN_MS;
}

async function findRequest(
  tx: MutationDb,
  requestId: string
): Promise<FriendRequestRow> {
  const rows = await tx.query(sql<FriendRequestRow>`
    SELECT id, from_user_id, to_user_id, status, responded_at
    FROM friend_requests WHERE id = ${requestId} LIMIT 1
  `);
  const request = rows[0];
  if (request === undefined) {
    throw new MutationError(FRIENDS_NOT_FOUND, 'Friend request not found.');
  }
  return request;
}

async function blockedEitherDirection(
  tx: MutationDb,
  userA: string,
  userB: string
): Promise<boolean> {
  const rows = await tx.query(sql<{ readonly id: string }>`
    SELECT id FROM user_blocks
    WHERE _deleted_at IS NULL
      AND (
        (blocker_id = ${userA} AND blocked_id = ${userB})
        OR (blocker_id = ${userB} AND blocked_id = ${userA})
      )
    LIMIT 1
  `);
  return rows.length > 0;
}

async function friendshipExists(
  tx: MutationDb,
  userA: string,
  userB: string
): Promise<boolean> {
  return friendshipExistsSql(tx, userA, userB);
}

async function requireRequestParty(
  tx: MutationDb,
  args: {
    readonly requestId: string;
    readonly actor: string;
    readonly party: 'from_user_id' | 'to_user_id';
    readonly action: string;
  }
): Promise<FriendRequestRow> {
  const request = await findRequest(tx, args.requestId);
  if (request[args.party] !== args.actor) {
    throw new MutationError(
      FRIENDS_FORBIDDEN,
      `Cannot ${args.action} this request.`
    );
  }
  return request;
}

async function updateRequestStatus(
  tx: MutationDb,
  requestId: string,
  status: 'accepted' | 'cancelled' | 'declined',
  now: string
): Promise<void> {
  await tx.run(sql`
    UPDATE friend_requests
    SET status = ${status}, updated_at = ${now}, responded_at = ${now}
    WHERE id = ${requestId}
  `);
}

async function acceptRequestsBetween(
  tx: MutationDb,
  actor: string,
  other: string,
  now: string
): Promise<void> {
  await tx.run(sql`
    UPDATE friend_requests
    SET status = 'accepted', updated_at = ${now}, responded_at = ${now}
    WHERE status = 'pending'
      AND (
        (from_user_id = ${actor} AND to_user_id = ${other})
        OR (from_user_id = ${other} AND to_user_id = ${actor})
      )
  `);
}

async function cancelPendingRequests(
  tx: MutationDb,
  actor: string,
  other: string,
  now: string
): Promise<void> {
  await tx.run(sql`
    UPDATE friend_requests
    SET status = 'cancelled', updated_at = ${now}, responded_at = ${now}
    WHERE status = 'pending'
      AND (
        (from_user_id = ${actor} AND to_user_id = ${other})
        OR (from_user_id = ${other} AND to_user_id = ${actor})
      )
  `);
}

async function hasPendingRequest(
  tx: MutationDb,
  fromUserId: string,
  toUserId: string
): Promise<boolean> {
  const rows = await tx.query(sql<{ readonly id: string }>`
    SELECT id FROM friend_requests
    WHERE from_user_id = ${fromUserId}
      AND to_user_id = ${toUserId}
      AND status = 'pending'
    LIMIT 1
  `);
  return rows.length > 0;
}

async function latestDeclinedRequest(
  tx: MutationDb,
  fromUserId: string,
  toUserId: string
): Promise<FriendRequestRow | undefined> {
  const rows = await tx.query(sql<FriendRequestRow>`
    SELECT id, from_user_id, to_user_id, status, responded_at
    FROM friend_requests
    WHERE from_user_id = ${fromUserId}
      AND to_user_id = ${toUserId}
      AND status = 'declined'
    ORDER BY updated_at DESC LIMIT 1
  `);
  return rows[0];
}

async function validateSendFriendRequest(
  tx: MutationDb,
  fromUserId: string,
  toUserId: string,
  now: Date
): Promise<boolean> {
  if (await blockedEitherDirection(tx, fromUserId, toUserId)) {
    throw new MutationError(FRIENDS_BLOCKED, 'You cannot send this request.');
  }
  if (await friendshipExists(tx, fromUserId, toUserId)) {
    throw new MutationError(
      FRIENDS_ALREADY_FRIENDS,
      'You are already friends.'
    );
  }
  if (await hasPendingRequest(tx, fromUserId, toUserId)) return false;
  if (await hasPendingRequest(tx, toUserId, fromUserId)) {
    throw new MutationError(
      FRIENDS_REQUEST_EXISTS,
      'A request already exists.'
    );
  }
  const declined = await latestDeclinedRequest(tx, fromUserId, toUserId);
  if (
    declined?.responded_at !== null &&
    declined?.responded_at !== undefined &&
    resendCooldownActive(declined.responded_at, now)
  ) {
    throw new MutationError(
      FRIENDS_COOLDOWN,
      'Please wait before trying again.'
    );
  }
  return true;
}

export const sendFriendRequestMutation = defineMutation({
  name: 'sendFriendRequest',
  args: z.object({
    requestId: z.string().min(1),
    toUserId: z.string().min(1),
    message: z.string().nullable().optional(),
  }),
  writes: ['friend_requests'],
  invalidates: ({ toUserId }, env) => friendsPartyInvalidates(env, toUserId),
  async run({ tx, env }, { requestId, toUserId, message }) {
    const fromUserId = otherUserId(env, toUserId, 'send a friend request to');
    const nowDate = env.now();
    if (!(await validateSendFriendRequest(tx, fromUserId, toUserId, nowDate)))
      return;
    const now = nowDate.toISOString();
    await tx.run(sql`
      INSERT INTO friend_requests (
        id, from_user_id, to_user_id, status, message, created_at, updated_at
      ) VALUES (
        ${requestId}, ${fromUserId}, ${toUserId}, 'pending',
        ${message?.slice(0, 200) ?? null}, ${now}, ${now}
      )
      ON CONFLICT (id) DO NOTHING
    `);
  },
});

export const acceptFriendRequestMutation = defineMutation({
  name: 'acceptFriendRequest',
  args: requestIdArgs,
  writes: ['friend_requests', 'friendships'],
  invalidates: (_args, env) => [userTopic(env.actorId)],
  async run({ tx, env }, { requestId }) {
    const actor = actorId(env);
    const request = await requireRequestParty(tx, {
      requestId,
      actor,
      party: 'to_user_id',
      action: 'accept',
    });
    if (request.status === 'accepted') return;
    if (request.status !== 'pending') {
      throw new MutationError(
        FRIENDS_FORBIDDEN,
        'Friend request is not pending.'
      );
    }
    if (await blockedEitherDirection(tx, actor, request.from_user_id)) {
      throw new MutationError(
        FRIENDS_BLOCKED,
        'You cannot accept this request.'
      );
    }
    const now = env.now().toISOString();
    await acceptRequestsBetween(tx, actor, request.from_user_id, now);
    const { userLow, userHigh } = canonicalUserPair(
      actor,
      request.from_user_id
    );
    await tx.run(sql`
      INSERT INTO friendships (
        id, user_low, user_high, created_at, source_request_id, _deleted_at
      )
      VALUES (
        ${pairId(userLow, userHigh)}, ${userLow}, ${userHigh}, ${now},
        ${requestId}, ${null}
      )
      ON CONFLICT (user_low, user_high) DO UPDATE SET
        _deleted_at = NULL,
        created_at = excluded.created_at,
        source_request_id = excluded.source_request_id
    `);
  },
});

export const declineFriendRequestMutation = defineMutation({
  name: 'declineFriendRequest',
  args: requestIdArgs,
  writes: ['friend_requests'],
  invalidates: (_args, env) => [userTopic(env.actorId)],
  async run({ tx, env }, { requestId }) {
    const request = await requireRequestParty(tx, {
      requestId,
      actor: actorId(env),
      party: 'to_user_id',
      action: 'decline',
    });
    if (request.status === 'pending') {
      await updateRequestStatus(
        tx,
        requestId,
        'declined',
        env.now().toISOString()
      );
    }
  },
});

export const cancelFriendRequestMutation = defineMutation({
  name: 'cancelFriendRequest',
  args: requestIdArgs,
  writes: ['friend_requests'],
  invalidates: (_args, env) => [userTopic(env.actorId)],
  async run({ tx, env }, { requestId }) {
    const request = await requireRequestParty(tx, {
      requestId,
      actor: actorId(env),
      party: 'from_user_id',
      action: 'cancel',
    });
    if (request.status === 'pending') {
      await updateRequestStatus(
        tx,
        requestId,
        'cancelled',
        env.now().toISOString()
      );
    }
  },
});

export const removeFriendMutation = defineMutation({
  name: 'removeFriend',
  args: userIdArgs,
  writes: ['friendships'],
  invalidates: ({ userId }, env) => friendsPartyInvalidates(env, userId),
  async run({ tx, env }, { userId }) {
    const actor = otherUserId(env, userId, 'remove');
    if (!(await friendshipExists(tx, actor, userId))) {
      throw new MutationError(FRIENDS_NOT_FOUND, 'Friendship not found.');
    }
    await softDeleteFriendship(tx, actor, userId, env.now().toISOString());
  },
});

export const blockUserMutation = defineMutation({
  name: 'blockUser',
  args: userIdArgs.extend({ blockId: z.string().min(1) }),
  writes: ['friend_requests', 'friendships', 'user_blocks'],
  invalidates: ({ userId }, env) => friendsPartyInvalidates(env, userId),
  async run({ tx, env }, { userId, blockId }) {
    const actor = otherUserId(env, userId, 'block');
    const now = env.now().toISOString();
    await softDeleteFriendship(tx, actor, userId, now);
    await cancelPendingRequests(tx, actor, userId, now);
    await tx.run(sql`
      INSERT INTO user_blocks (id, blocker_id, blocked_id, created_at, _deleted_at)
      VALUES (${blockId}, ${actor}, ${userId}, ${now}, ${null})
      ON CONFLICT (blocker_id, blocked_id) DO UPDATE SET
        _deleted_at = NULL,
        created_at = excluded.created_at
    `);
  },
});

export const unblockUserMutation = defineMutation({
  name: 'unblockUser',
  args: userIdArgs,
  writes: ['user_blocks'],
  invalidates: ({ userId }, env) => friendsPartyInvalidates(env, userId),
  async run({ tx, env }, { userId }) {
    const actor = otherUserId(env, userId, 'unblock');
    await softDeleteBlock(tx, actor, userId, env.now().toISOString());
  },
});

export const FRIENDS_MUTATIONS = [
  sendFriendRequestMutation,
  acceptFriendRequestMutation,
  declineFriendRequestMutation,
  cancelFriendRequestMutation,
  removeFriendMutation,
  blockUserMutation,
  unblockUserMutation,
] as const;
