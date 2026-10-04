import { lockOwners } from '@pkgs/matchmaking-sql-shared/owner-repository';
import { Outbox } from '@pkgs/outbox-shared/outbox';
import sql from '@pkgs/sql-shared/sql';
import { defineMutation } from '@pkgs/sync-engine-shared/define-mutation';
import type {
  MutationDb,
  MutationEnv,
} from '@pkgs/sync-engine-shared/mutations-types';
import { MutationError } from '@pkgs/sync-engine-shared/mutations-types';
import { z } from 'zod';
import { friendsActor } from './friends-actor';
import { FRIENDS_SELF } from './friends-mutation-codes';
import { FriendRequestClosed } from './friends-outbox-messages';
import { FriendshipRepository } from './friendship-repository';

async function cancelPendingRequests(args: {
  readonly tx: MutationDb;
  readonly env: MutationEnv;
  readonly actor: string;
  readonly other: string;
  readonly now: string;
}): Promise<void> {
  const { tx, env, actor, other, now } = args;
  const pending = await tx.query(
    sql<{ readonly id: string; readonly to_user_id: string }>`
    SELECT id, to_user_id FROM friends_requests
    WHERE status = 'pending'
      AND (
        (from_user_id = ${actor} AND to_user_id = ${other})
        OR (from_user_id = ${other} AND to_user_id = ${actor})
      )
  `
  );
  await tx.run(sql`
    UPDATE friends_requests
    SET status = 'cancelled', updated_at = ${now}, responded_at = ${now}
    WHERE status = 'pending'
      AND (
        (from_user_id = ${actor} AND to_user_id = ${other})
        OR (from_user_id = ${other} AND to_user_id = ${actor})
      )
  `);
  const outbox = new Outbox({ tx, env });
  for (const row of pending) {
    await outbox.send({
      id: `friends.outbox/request-closed:${row.id}`,
      message: FriendRequestClosed({
        requestId: row.id,
        toUserId: row.to_user_id,
      }),
    });
  }
}

export const blockUserMutation = defineMutation({
  name: 'blockUser',
  args: z.object({ userId: z.string().min(1), blockId: z.string().min(1) }),
  async run({ tx, env }, { userId, blockId }) {
    const actor = await friendsActor(tx, env);
    if (env.serverNow !== undefined)
      await lockOwners(tx, [actor, userId], env.serverNow().toISOString());
    if (actor === userId) {
      throw new MutationError(FRIENDS_SELF, 'Cannot block yourself.');
    }
    const now = env.now().toISOString();
    await new FriendshipRepository(tx).softDelete(actor, userId, now);
    await cancelPendingRequests({ tx, env, actor, other: userId, now });
    await tx.run(sql`
      INSERT INTO friends_blocks (id, blocker_id, blocked_id, created_at, deleted_at)
      VALUES (${blockId}, ${actor}, ${userId}, ${now}, ${null})
      ON CONFLICT (blocker_id, blocked_id) DO UPDATE SET
        deleted_at = NULL,
        created_at = excluded.created_at
    `);
  },
});
