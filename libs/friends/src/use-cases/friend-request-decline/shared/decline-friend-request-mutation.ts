import { Outbox } from '@pkgs/outbox';
import { sql } from '@pkgs/sql';
import {
  defineMutation,
  type MutationDb,
  MutationError,
} from '@pkgs/sync-engine/shared';
import { z } from 'zod';
import { friendsActor } from '../../../shared/friendship/friends-actor';
import {
  FRIENDS_FORBIDDEN,
  FRIENDS_NOT_FOUND,
} from '../../../shared/friendship/friends-mutation-codes';
import { FriendRequestClosed } from '../../../shared/friendship/friends-outbox-messages';

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

export const declineFriendRequestMutation = defineMutation({
  name: 'declineFriendRequest',
  args: z.object({ requestId: z.string().min(1) }),
  async run({ tx, env }, { requestId }) {
    const actor = await friendsActor(tx, env);
    const request = await findRequest(tx, requestId);
    if (request.to_user_id !== actor) {
      throw new MutationError(
        FRIENDS_FORBIDDEN,
        'Cannot decline this request.'
      );
    }
    if (request.status === 'pending') {
      const now = env.now().toISOString();
      await tx.run(sql`
        UPDATE friends_requests
        SET status = 'declined', updated_at = ${now}, responded_at = ${now}
        WHERE id = ${requestId}
      `);
      await new Outbox({ tx, env }).send({
        id: `friends.outbox/request-closed:${requestId}`,
        message: FriendRequestClosed({
          requestId,
          toUserId: request.to_user_id,
        }),
      });
    }
  },
});
