import { sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type { MutationEnv } from '@pkgs/sync-engine/shared';
import { wrapMutationDb } from '@pkgs/sync-engine/shared';
import type { FriendRequest } from '../shared/friends-types';
import {
  acceptFriendRequestMutation,
  cancelFriendRequestMutation,
  declineFriendRequestMutation,
} from '../shared/mutations/friends-mutations';
import type { FriendsInboxPublisher } from './friends-inbox-publisher';

export type FriendsInboxActionArgs = {
  readonly actorId: string;
  readonly deviceId: string;
  readonly actionId: string;
  readonly requestId: string;
};

export class FriendsInboxActionHandler {
  constructor(
    private readonly sql: SqlClient,
    private readonly now: () => number,
    private readonly createId: () => string,
    private readonly inboxPublisher: FriendsInboxPublisher
  ) {}

  private mutationEnv(args: FriendsInboxActionArgs): MutationEnv {
    return {
      actorId: args.actorId,
      deviceId: args.deviceId,
      accountId: args.actorId,
      isAnon: false,
      now: () => new Date(this.now()),
      createId: this.createId,
    };
  }

  private async getRequest(requestId: string): Promise<FriendRequest> {
    const rows = await this.sql.query<{
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

  async handle(
    args: FriendsInboxActionArgs
  ): Promise<{ readonly userIds: readonly string[] }> {
    const env = this.mutationEnv(args);
    const wrapped = wrapMutationDb(this.sql, env);

    if (args.actionId === 'accept') {
      await acceptFriendRequestMutation.run(
        {
          tx: wrapped.tx,
          env,
        },
        { requestId: args.requestId }
      );
      const request = await this.getRequest(args.requestId);
      await this.inboxPublisher.deactivate(request);
      await this.inboxPublisher.publishAccepted(request);
      return { userIds: [request.fromUserId, request.toUserId] };
    }
    if (args.actionId === 'decline') {
      await declineFriendRequestMutation.run(
        {
          tx: wrapped.tx,
          env,
        },
        { requestId: args.requestId }
      );
      const request = await this.getRequest(args.requestId);
      await this.inboxPublisher.deactivate(request);
      return { userIds: [request.fromUserId, request.toUserId] };
    }
    if (args.actionId === 'cancel') {
      await cancelFriendRequestMutation.run(
        {
          tx: wrapped.tx,
          env,
        },
        { requestId: args.requestId }
      );
      const request = await this.getRequest(args.requestId);
      await this.inboxPublisher.deactivate(request);
      return { userIds: [request.fromUserId, request.toUserId] };
    }
    throw new Error(`Unknown friends inbox action: ${args.actionId}`);
  }
}
