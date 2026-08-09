import { sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type { MutationEnv } from '@pkgs/sync-engine/shared';
import type { FriendRequest } from '../shared/friends-types';
import {
  acceptFriendRequestMutation,
  cancelFriendRequestMutation,
  declineFriendRequestMutation,
} from '../shared/mutations/friends-mutations';
import {
  deactivateFriendRequestInteraction,
  publishFriendRequestAcceptedInteraction,
} from './friends-inbox-publish';

type InboxFriendsCtx = {
  readonly sql: SqlClient;
  readonly actorId: string;
  readonly deviceId: string;
  readonly actionId: string;
  readonly requestId: string;
  readonly now: () => number;
};

function mutationEnv(ctx: InboxFriendsCtx): MutationEnv {
  return {
    actorId: ctx.actorId,
    deviceId: ctx.deviceId,
    accountId: ctx.actorId,
    isAnon: false,
    now: () => new Date(ctx.now()),
  };
}

async function getRequest(
  db: SqlClient,
  requestId: string
): Promise<FriendRequest> {
  const rows = await db.query<{
    readonly id: string;
    readonly from_user_id: string;
    readonly to_user_id: string;
    readonly status: FriendRequest['status'];
    readonly message: string | null;
    readonly created_at: string;
    readonly updated_at: string;
    readonly responded_at: string | null;
  }>(sql`
    SELECT id, from_user_id, to_user_id, status, message, created_at, updated_at, responded_at
    FROM friend_requests WHERE id = ${requestId}
  `);
  const request = rows[0];
  if (request === undefined) {
    throw new Error(`Friend request not found: ${requestId}`);
  }
  return {
    id: request.id,
    fromUserId: request.from_user_id,
    toUserId: request.to_user_id,
    status: request.status,
    message: request.message,
    createdAt: request.created_at,
    updatedAt: request.updated_at,
    respondedAt: request.responded_at,
  };
}

export async function handleFriendsInboxAction(
  ctx: InboxFriendsCtx
): Promise<{ readonly userIds: readonly string[] }> {
  const env = mutationEnv(ctx);

  if (ctx.actionId === 'accept') {
    await acceptFriendRequestMutation.run(
      {
        tx: ctx.sql,
        env,
      },
      { requestId: ctx.requestId }
    );
    const request = await getRequest(ctx.sql, ctx.requestId);
    await deactivateFriendRequestInteraction(ctx.sql, request);
    await publishFriendRequestAcceptedInteraction(ctx.sql, request);
    return { userIds: [request.fromUserId, request.toUserId] };
  }
  if (ctx.actionId === 'decline') {
    await declineFriendRequestMutation.run(
      {
        tx: ctx.sql,
        env,
      },
      { requestId: ctx.requestId }
    );
    const request = await getRequest(ctx.sql, ctx.requestId);
    await deactivateFriendRequestInteraction(ctx.sql, request);
    return { userIds: [request.fromUserId, request.toUserId] };
  }
  if (ctx.actionId === 'cancel') {
    await cancelFriendRequestMutation.run(
      {
        tx: ctx.sql,
        env,
      },
      { requestId: ctx.requestId }
    );
    const request = await getRequest(ctx.sql, ctx.requestId);
    await deactivateFriendRequestInteraction(ctx.sql, request);
    return { userIds: [request.fromUserId, request.toUserId] };
  }
  throw new Error(`Unknown friends inbox action: ${ctx.actionId}`);
}
