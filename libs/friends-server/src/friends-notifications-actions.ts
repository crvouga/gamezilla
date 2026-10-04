import { accountSyncActor } from '@libs/auth-shared/auth-context';
import type { FriendRequest } from '@libs/friends-shared/friends-types';
import type { Clock } from '@pkgs/clock-shared/types';
import type { SqlTx } from '@pkgs/sql-client-root-shared/interface';
import sql from '@pkgs/sql-root-shared/sql';
import type { MutationEnv } from '@pkgs/sync-engine-shared/mutations-types';
import type { CreateId } from '@pkgs/uuid-shared/create-id';
import { applyAcceptFriendRequest } from './apply-accept-friend-request';
import { applyCancelFriendRequest } from './apply-cancel-friend-request';
import { applyDeclineFriendRequest } from './apply-decline-friend-request';

export type FriendsNotificationsActionArgs = {
  readonly actorId: string;
  readonly deviceId: string;
  readonly actionId: string;
  readonly requestId: string;
};

/** Runs friend mutations from notification card actions; outbox covers notify. */
export class FriendsNotificationsActionHandler {
  constructor(
    private readonly tx: SqlTx,
    private readonly time: {
      readonly clock: Clock;
      readonly createId: CreateId;
    }
  ) {}

  private mutationEnv(args: FriendsNotificationsActionArgs): MutationEnv {
    return {
      ...accountSyncActor({ accountId: args.actorId, deviceId: args.deviceId }),
      now: () => new Date(this.time.clock.now()),
      createId: this.time.createId,
    };
  }

  private async getRequest(requestId: string): Promise<FriendRequest> {
    const rows = await this.tx.query<{
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
      FROM friends_requests WHERE id = ${requestId}
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

  async handle(
    args: FriendsNotificationsActionArgs
  ): Promise<{ readonly userIds: readonly string[] }> {
    const env = this.mutationEnv(args);

    if (args.actionId === 'accept') {
      await applyAcceptFriendRequest(this.tx, env, args.requestId);
      const request = await this.getRequest(args.requestId);
      return { userIds: [request.fromUserId, request.toUserId] };
    }
    if (args.actionId === 'decline') {
      await applyDeclineFriendRequest(this.tx, env, args.requestId);
      const request = await this.getRequest(args.requestId);
      return { userIds: [request.fromUserId, request.toUserId] };
    }
    if (args.actionId === 'cancel') {
      await applyCancelFriendRequest(this.tx, env, args.requestId);
      const request = await this.getRequest(args.requestId);
      return { userIds: [request.fromUserId, request.toUserId] };
    }
    throw new Error(`Unknown friends notification action: ${args.actionId}`);
  }
}
