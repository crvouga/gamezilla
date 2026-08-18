import { Outbox } from '@pkgs/outbox';
import { sql } from '@pkgs/sql';
import {
  defineMutation,
  type MutationDb,
  type MutationEnv,
  MutationError,
} from '@pkgs/sync-engine/shared';
import { z } from 'zod';
import {
  FRIEND_REQUEST_RESEND_COOLDOWN_MS,
  FRIENDS_ALREADY_FRIENDS,
  FRIENDS_BLOCKED,
  FRIENDS_COOLDOWN,
  FRIENDS_NOT_SIGNED_IN,
  FRIENDS_REQUEST_EXISTS,
  FRIENDS_SELF,
} from '../../../shared/friendship/friends-mutation-codes';
import { FriendRequestSent } from '../../../shared/friendship/friends-outbox-messages';
import { FriendshipRepository } from '../../../shared/friendship/friends-sql/friendship-repository';

type FriendRequestRow = {
  readonly id: string;
  readonly from_user_id: string;
  readonly to_user_id: string;
  readonly status: string;
  readonly responded_at: string | null;
};

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

async function blockedEitherDirection(
  tx: MutationDb,
  userA: string,
  userB: string
): Promise<boolean> {
  const rows = await tx.query(sql<{ readonly id: string }>`
    SELECT id FROM friends_blocks
    WHERE deleted_at IS NULL
      AND (
        (blocker_id = ${userA} AND blocked_id = ${userB})
        OR (blocker_id = ${userB} AND blocked_id = ${userA})
      )
    LIMIT 1
  `);
  return rows.length > 0;
}

async function hasPendingRequest(
  tx: MutationDb,
  fromUserId: string,
  toUserId: string
): Promise<boolean> {
  const rows = await tx.query(sql<{ readonly id: string }>`
    SELECT id FROM friends_requests
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
    FROM friends_requests
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
  if (await new FriendshipRepository(tx).exists(fromUserId, toUserId)) {
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
  async run({ tx, env }, { requestId, toUserId, message }) {
    const fromUserId = otherUserId(env, toUserId, 'send a friend request to');
    const nowDate = env.now();
    if (!(await validateSendFriendRequest(tx, fromUserId, toUserId, nowDate))) {
      return;
    }
    const now = nowDate.toISOString();
    await tx.run(sql`
      INSERT INTO friends_requests (
        id, from_user_id, to_user_id, status, message, created_at, updated_at
      ) VALUES (
        ${requestId}, ${fromUserId}, ${toUserId}, 'pending',
        ${message?.slice(0, 200) ?? null}, ${now}, ${now}
      )
      ON CONFLICT (id) DO NOTHING
    `);
    await new Outbox({ tx, env }).send({
      id: `friends.outbox/request-sent:${requestId}`,
      message: FriendRequestSent({
        requestId,
        fromUserId,
        toUserId,
      }),
    });
  },
});
