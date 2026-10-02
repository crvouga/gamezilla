import { Outbox } from '@pkgs/outbox';
import { sql } from '@pkgs/sql';
import {
  defineMutation,
  type MutationDb,
  MutationError,
} from '@pkgs/sync-engine/shared';
import { z } from 'zod';

import { canonicalUserPair } from '../../../shared/friendship/canonical-pair';
import { friendsActor } from '../../../shared/friendship/friends-actor';
import {
  FRIENDS_BLOCKED,
  FRIENDS_FORBIDDEN,
  FRIENDS_NOT_FOUND,
} from '../../../shared/friendship/friends-mutation-codes';
import { FriendRequestAccepted } from '../../../shared/friendship/friends-outbox-messages';
import { pairId } from '../../../shared/friendship/pair-id';

type FriendRequestRow = {
  readonly id: string;
  readonly from_user_id: string;
  readonly to_user_id: string;
  readonly status: string;
  readonly responded_at: string | null;
};

async function findRequest(
  tx: MutationDb,
  requestId: string
): Promise<FriendRequestRow> {
  const rows = await tx.query(sql<FriendRequestRow>`
    SELECT id, from_user_id, to_user_id, status, responded_at
    FROM friends_requests WHERE id = ${requestId} LIMIT 1
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

export const acceptFriendRequestMutation = defineMutation({
  name: 'acceptFriendRequest',
  pendingUx: 'pending',
  args: z.object({ requestId: z.string().min(1) }),
  async run({ tx, env }, { requestId }) {
    const actor = await friendsActor(tx, env);
    const request = await findRequest(tx, requestId);
    if (request.status === 'account_deleted')
      throw new MutationError(
        'account_deleted',
        'This request is no longer available because the account was deleted.'
      );
    if (request.to_user_id !== actor) {
      throw new MutationError(FRIENDS_FORBIDDEN, 'Cannot accept this request.');
    }
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
    await tx.run(sql`
      UPDATE friends_requests
      SET status = 'accepted', updated_at = ${now}, responded_at = ${now}
      WHERE status = 'pending'
        AND (
          (from_user_id = ${actor} AND to_user_id = ${request.from_user_id})
          OR (from_user_id = ${request.from_user_id} AND to_user_id = ${actor})
        )
    `);
    const { userLow, userHigh } = canonicalUserPair(
      actor,
      request.from_user_id
    );
    await tx.run(sql`
      INSERT INTO friends_friendships (
        id, user_low, user_high, created_at, source_request_id, deleted_at
      )
      VALUES (
        ${pairId(userLow, userHigh)}, ${userLow}, ${userHigh}, ${now},
        ${requestId}, ${null}
      )
      ON CONFLICT (user_low, user_high) DO UPDATE SET
        deleted_at = NULL,
        created_at = excluded.created_at,
        source_request_id = excluded.source_request_id
    `);
    await new Outbox({ tx, env }).send({
      id: `friends.outbox/request-accepted:${requestId}`,
      message: FriendRequestAccepted({
        requestId,
        fromUserId: request.from_user_id,
        toUserId: request.to_user_id,
      }),
    });
  },
});
