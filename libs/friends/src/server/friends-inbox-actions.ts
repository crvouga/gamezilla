import type { SqlClient } from '@pkgs/sql-client/interface';
import { isRulesReject } from '@pkgs/rules/core/rules-reject';
import { messageForFailure } from '@pkgs/rules/core/messages';
import { FRIENDS_MESSAGES } from '@libs/friends/shared/rules/messages';
import { mapAppAuthToRulesAuth } from '@libs/auth/shared/map-app-auth-to-rules-auth';

import {
  acceptFriendRequest,
  authorizeAccept,
  publishAcceptFriendRequestEvent,
} from '../shared/accept-friend-request/accept-friend-request-write';
import { cancelFriendRequest } from '../shared/cancel-friend-request/cancel-friend-request-write';
import { declineFriendRequest } from '../shared/decline-friend-request/decline-friend-request-write';
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
};

function rulesAuthFromInbox(ctx: InboxFriendsCtx) {
  return mapAppAuthToRulesAuth({
    deviceId: ctx.deviceId,
    accountId: ctx.actorId,
    myId: ctx.actorId,
  });
}

async function runInboxMutation<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (isRulesReject(error) && error.failures[0] !== undefined) {
      const failure = error.failures[0];
      throw new Error(
        `${failure.code}: ${messageForFailure(failure, FRIENDS_MESSAGES)}`
      );
    }
    throw error;
  }
}

export async function handleFriendsInboxAction(
  ctx: InboxFriendsCtx
): Promise<void> {
  const auth = rulesAuthFromInbox(ctx);
  const input = { requestId: ctx.requestId };

  if (ctx.actionId === 'accept') {
    const result = await runInboxMutation(async () => {
      await authorizeAccept(auth, input, ctx.sql);
      return acceptFriendRequest(auth, input, ctx.sql);
    });
    if (result.accepted) {
      publishAcceptFriendRequestEvent(auth, result.request);
    }
    await deactivateFriendRequestInteraction(ctx.sql, result.request);
    await publishFriendRequestAcceptedInteraction(ctx.sql, result.request);
    return;
  }
  if (ctx.actionId === 'decline') {
    const request = await runInboxMutation(() =>
      declineFriendRequest(auth, input, ctx.sql)
    );
    await deactivateFriendRequestInteraction(ctx.sql, request);
    return;
  }
  if (ctx.actionId === 'cancel') {
    const request = await runInboxMutation(() =>
      cancelFriendRequest(auth, input, ctx.sql)
    );
    await deactivateFriendRequestInteraction(ctx.sql, request);
    return;
  }
  throw new Error(`Unknown friends inbox action: ${ctx.actionId}`);
}
