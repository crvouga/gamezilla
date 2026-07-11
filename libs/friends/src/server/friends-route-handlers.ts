import type { ApiHonoEnv } from '@libs/auth/server/api-hono-env';
import type { Context } from 'hono';

import type { FriendRequest, FriendshipStatus } from '../shared/friends-types';
import { FriendService } from './friend-service';
import { readRequiredString } from './friends-route-utils';
import { withFriendsAuth } from './friends-route-auth';

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

export function handleFriendshipStatus(
  c: Context<ApiHonoEnv>
): Promise<Response> {
  return withFriendsAuth(c, async (auth) => {
    const targetUserId = readRequiredString(c.req.param('userId'), 'userId');
    const sql = c.get('sqlClient');
    const status: FriendshipStatus =
      await FriendService.resolveFriendshipStatus(sql, auth.myId, targetUserId);
    return c.json({ status });
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
    const request: FriendRequest = await FriendService.sendFriendRequest(
      sql,
      auth.myId,
      toUserId,
      message
    );
    return c.json({ request });
  });
}

export function handleAcceptFriendRequest(
  c: Context<ApiHonoEnv>
): Promise<Response> {
  return withFriendsAuth(c, async (auth) => {
    const requestId = readRequiredString(c.req.param('id'), 'id');
    const sql = c.get('sqlClient');
    const request = await FriendService.acceptFriendRequest(
      sql,
      auth.myId,
      requestId
    );
    return c.json({ request });
  });
}

export function handleDeclineFriendRequest(
  c: Context<ApiHonoEnv>
): Promise<Response> {
  return withFriendsAuth(c, async (auth) => {
    const requestId = readRequiredString(c.req.param('id'), 'id');
    const sql = c.get('sqlClient');
    const request = await FriendService.declineFriendRequest(
      sql,
      auth.myId,
      requestId
    );
    return c.json({ request });
  });
}

export function handleCancelFriendRequest(
  c: Context<ApiHonoEnv>
): Promise<Response> {
  return withFriendsAuth(c, async (auth) => {
    const requestId = readRequiredString(c.req.param('id'), 'id');
    const sql = c.get('sqlClient');
    const request = await FriendService.cancelFriendRequest(
      sql,
      auth.myId,
      requestId
    );
    return c.json({ request });
  });
}

export function handleRemoveFriend(c: Context<ApiHonoEnv>): Promise<Response> {
  return withFriendsAuth(c, async (auth) => {
    const friendUserId = readRequiredString(c.req.param('userId'), 'userId');
    const sql = c.get('sqlClient');
    await FriendService.removeFriend(sql, auth.myId, friendUserId);
    return c.json({ ok: true });
  });
}

export function handleBlockUser(c: Context<ApiHonoEnv>): Promise<Response> {
  return withFriendsAuth(c, async (auth) => {
    const body = (await c.req.json()) as BlockBody;
    const userId = readRequiredString(body.userId, 'userId');
    const sql = c.get('sqlClient');
    await FriendService.blockUser(sql, auth.myId, userId);
    return c.json({ ok: true });
  });
}

export function handleUnblockUser(c: Context<ApiHonoEnv>): Promise<Response> {
  return withFriendsAuth(c, async (auth) => {
    const userId = readRequiredString(c.req.param('userId'), 'userId');
    const sql = c.get('sqlClient');
    await FriendService.unblockUser(sql, auth.myId, userId);
    return c.json({ ok: true });
  });
}

export function handleMutualFriends(c: Context<ApiHonoEnv>): Promise<Response> {
  return withFriendsAuth(c, async (auth) => {
    const targetUserId = readRequiredString(c.req.param('userId'), 'userId');
    const sql = c.get('sqlClient');
    const friends = await FriendService.listMutualFriends(
      sql,
      auth.myId,
      targetUserId
    );
    return c.json({ friends });
  });
}
