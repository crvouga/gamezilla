import type { ApiHonoEnv } from '@libs/auth/server/api-hono-env';
import { mapAppAuthToRulesAuth } from '@libs/auth/shared/map-app-auth-to-rules-auth';
import type { Context } from 'hono';

import {
  acceptFriendRequest,
  authorizeAccept,
  publishAcceptFriendRequestEvent,
} from '../shared/accept-friend-request/accept-friend-request-write';
import {
  blockUser,
  publishBlockUserEvent,
} from '../shared/block-user/block-user-write';
import { cancelFriendRequest } from '../shared/cancel-friend-request/cancel-friend-request-write';
import { declineFriendRequest } from '../shared/decline-friend-request/decline-friend-request-write';
import type { FriendRequest } from '../shared/friends-types';
import {
  publishRemoveFriendEvent,
  removeFriend,
} from '../shared/remove-friend/remove-friend-write';
import {
  publishSendFriendRequestEvent,
  sendFriendRequest,
} from '../shared/send-friend-request/send-friend-request-write';
import { unblockUser } from '../shared/unblock-user/unblock-user-write';
import { FriendService } from './friend-service';
import { readRequiredString } from './friends-route-utils';
import { withFriendsAuth } from './friends-route-auth';
import {
  deactivateFriendRequestInteraction,
  deactivatePendingFriendRequestInteractionsBetween,
  publishFriendRequestAcceptedInteraction,
  publishIncomingFriendRequestInteraction,
} from './friends-inbox-publish';
import { jsonWriteFailure, runFriendsMutation } from './run-friends-write';

type SearchBody = { readonly query?: string; readonly limit?: number };
type SendRequestBody = {
  readonly toUserId?: string;
  readonly message?: string | null;
};
type BlockBody = { readonly userId?: string };

export function handleSearchUsers(c: Context<ApiHonoEnv>): Promise<Response> {
  return withFriendsAuth(c, async (auth) => {
    const body = (await c.req.json()) as SearchBody;
    const query = readRequiredString(body.query, 'query');
    const sql = c.get('sqlClient');
    const results = await FriendService.searchUsers(
      sql,
      auth.myId,
      query,
      typeof body.limit === 'number' ? body.limit : undefined
    );
    return c.json({ results });
  });
}

export function handleSendFriendRequest(
  c: Context<ApiHonoEnv>
): Promise<Response> {
  return withFriendsAuth(c, async (auth) => {
    const body = (await c.req.json()) as SendRequestBody;
    const toUserId = readRequiredString(body.toUserId, 'toUserId');
    const message =
      typeof body.message === 'string' ? body.message.slice(0, 200) : null;
    const sql = c.get('sqlClient');
    const outcome = await runFriendsMutation(auth, sql, (rulesAuth, db) =>
      sendFriendRequest(rulesAuth, { toUserId, message }, db)
    );
    if (!outcome.ok) return jsonWriteFailure(c, outcome.failure);
    const request: FriendRequest = outcome.value.request;
    if (outcome.value.created) {
      publishSendFriendRequestEvent(request);
      await publishIncomingFriendRequestInteraction(sql, request);
    }
    return c.json({ request });
  });
}

export function handleAcceptFriendRequest(
  c: Context<ApiHonoEnv>
): Promise<Response> {
  return withFriendsAuth(c, async (auth) => {
    const requestId = readRequiredString(c.req.param('id'), 'id');
    const sql = c.get('sqlClient');
    const outcome = await runFriendsMutation(
      auth,
      sql,
      async (rulesAuth, db) => {
        const input = { requestId };
        await authorizeAccept(rulesAuth, input, db);
        return acceptFriendRequest(rulesAuth, input, db);
      }
    );
    if (!outcome.ok) return jsonWriteFailure(c, outcome.failure);
    const request = outcome.value.request;
    if (outcome.value.accepted) {
      publishAcceptFriendRequestEvent(mapAppAuthToRulesAuth(auth), request);
    }
    await deactivateFriendRequestInteraction(sql, request);
    await publishFriendRequestAcceptedInteraction(sql, request);
    return c.json({ request });
  });
}

export function handleDeclineFriendRequest(
  c: Context<ApiHonoEnv>
): Promise<Response> {
  return withFriendsAuth(c, async (auth) => {
    const requestId = readRequiredString(c.req.param('id'), 'id');
    const sql = c.get('sqlClient');
    const outcome = await runFriendsMutation(auth, sql, (rulesAuth, db) =>
      declineFriendRequest(rulesAuth, { requestId }, db)
    );
    if (!outcome.ok) return jsonWriteFailure(c, outcome.failure);
    await deactivateFriendRequestInteraction(sql, outcome.value);
    return c.json({ request: outcome.value });
  });
}

export function handleCancelFriendRequest(
  c: Context<ApiHonoEnv>
): Promise<Response> {
  return withFriendsAuth(c, async (auth) => {
    const requestId = readRequiredString(c.req.param('id'), 'id');
    const sql = c.get('sqlClient');
    const outcome = await runFriendsMutation(auth, sql, (rulesAuth, db) =>
      cancelFriendRequest(rulesAuth, { requestId }, db)
    );
    if (!outcome.ok) return jsonWriteFailure(c, outcome.failure);
    await deactivateFriendRequestInteraction(sql, outcome.value);
    return c.json({ request: outcome.value });
  });
}

export function handleRemoveFriend(c: Context<ApiHonoEnv>): Promise<Response> {
  return withFriendsAuth(c, async (auth) => {
    const friendUserId = readRequiredString(c.req.param('userId'), 'userId');
    const sql = c.get('sqlClient');
    const outcome = await runFriendsMutation(
      auth,
      sql,
      async (rulesAuth, db) => {
        await removeFriend(rulesAuth, { userId: friendUserId }, db);
        publishRemoveFriendEvent(rulesAuth, friendUserId);
      }
    );
    if (!outcome.ok) return jsonWriteFailure(c, outcome.failure);
    return c.json({ ok: true });
  });
}

export function handleBlockUser(c: Context<ApiHonoEnv>): Promise<Response> {
  return withFriendsAuth(c, async (auth) => {
    const body = (await c.req.json()) as BlockBody;
    const userId = readRequiredString(body.userId, 'userId');
    const sql = c.get('sqlClient');
    const outcome = await runFriendsMutation(
      auth,
      sql,
      async (rulesAuth, db) => {
        await blockUser(rulesAuth, { userId }, db);
        publishBlockUserEvent(rulesAuth, userId);
      }
    );
    if (!outcome.ok) return jsonWriteFailure(c, outcome.failure);
    await deactivatePendingFriendRequestInteractionsBetween(
      sql,
      auth.myId,
      userId
    );
    return c.json({ ok: true });
  });
}

export function handleUnblockUser(c: Context<ApiHonoEnv>): Promise<Response> {
  return withFriendsAuth(c, async (auth) => {
    const userId = readRequiredString(c.req.param('userId'), 'userId');
    const sql = c.get('sqlClient');
    const outcome = await runFriendsMutation(auth, sql, (rulesAuth, db) =>
      unblockUser(rulesAuth, { userId }, db)
    );
    if (!outcome.ok) return jsonWriteFailure(c, outcome.failure);
    return c.json({ ok: true });
  });
}
