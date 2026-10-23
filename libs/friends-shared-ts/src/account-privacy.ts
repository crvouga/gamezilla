import type { AccountPrivacyContribution } from '@libs/sub-shared-ts/account-privacy';
import { Outbox } from '@pkgs/outbox-shared-ts/outbox';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { FriendRequestClosed } from './friends-outbox-messages';

export const FRIENDS_PRIVACY: AccountPrivacyContribution = {
  name: 'friends and requests',
  snapshot: async ({ tx, env }) => ({
    friendships: await tx.query(
      sql<
        Record<string, unknown>
      >`SELECT user_low, user_high, created_at FROM friends_friendships WHERE (user_low = ${env.actorId} OR user_high = ${env.actorId}) AND deleted_at IS NULL`
    ),
    requests: await tx.query(
      sql<
        Record<string, unknown>
      >`SELECT from_user_id, to_user_id, status, message, created_at, responded_at FROM friends_requests WHERE (from_user_id = ${env.actorId} OR to_user_id = ${env.actorId}) AND deleted_at IS NULL`
    ),
    blocks: await tx.query(
      sql<
        Record<string, unknown>
      >`SELECT blocked_id, created_at FROM friends_blocks WHERE blocker_id = ${env.actorId} AND deleted_at IS NULL`
    ),
  }),
  withdraw: async (ctx) => {
    const now = (ctx.env.serverNow ?? ctx.env.now)().toISOString();
    const requests = await ctx.tx.query(
      sql<{
        id: string;
        to_user_id: string;
      }>`SELECT id, to_user_id FROM friends_requests WHERE (from_user_id = ${ctx.env.actorId} OR to_user_id = ${ctx.env.actorId}) AND status = ${'pending'} AND deleted_at IS NULL`
    );
    for (const request of requests)
      await new Outbox(ctx).send({
        id: `friends.outbox/request-closed:${request.id}`,
        message: FriendRequestClosed({
          requestId: request.id,
          toUserId: request.to_user_id,
        }),
      });
    await ctx.tx.run(
      sql`UPDATE friends_requests SET status = ${'account_deleted'}, deleted_at = ${now}, responded_at = ${now} WHERE from_user_id = ${ctx.env.actorId} OR to_user_id = ${ctx.env.actorId}`
    );
    await ctx.tx.run(
      sql`UPDATE friends_friendships SET deleted_at = ${now} WHERE user_low = ${ctx.env.actorId} OR user_high = ${ctx.env.actorId}`
    );
    await ctx.tx.run(
      sql`UPDATE friends_blocks SET deleted_at = ${now} WHERE blocker_id = ${ctx.env.actorId} OR blocked_id = ${ctx.env.actorId}`
    );
  },
  erase: async ({ tx, env }) => {
    await tx.run(
      sql`UPDATE friends_requests SET from_user_id = ${null}, to_user_id = ${null}, message = ${null} WHERE from_user_id = ${env.actorId} OR to_user_id = ${env.actorId}`
    );
    await tx.run(
      sql`UPDATE friends_friendships SET user_low = ${null}, user_high = ${null}, source_request_id = ${null} WHERE user_low = ${env.actorId} OR user_high = ${env.actorId}`
    );
    await tx.run(
      sql`UPDATE friends_blocks SET blocker_id = ${null}, blocked_id = ${null} WHERE blocker_id = ${env.actorId} OR blocked_id = ${env.actorId}`
    );
  },
};
