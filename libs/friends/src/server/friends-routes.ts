import { UnauthorizedError } from '@libs/auth/server/unauthorized-error';
import type { ApiHonoEnv } from '@libs/auth/server/api-hono-env';
import { appAuth, type AppAuth } from '@libs/auth/shared/auth-context';
import type { Context } from 'hono';
import { Hono } from 'hono';

import { FriendsError, isFriendsError, type FriendsErrorCode } from '../shared/friends-errors';
import type { FriendRequest, FriendshipStatus } from '../shared/friends-types';
import { FriendService } from './friend-service';

async function requireSignedInFriendsAuth(c: Context<ApiHonoEnv>): Promise<AppAuth> {
  const sessionAuth = c.get('sessionAuth');
  const sql = c.get('sqlClient');
  try {
    const ctx = await sessionAuth.requireAuthContext(sql, c.req.raw);
    const auth = appAuth(ctx);
    if (auth === null || auth.accountId === null) {
      throw new UnauthorizedError('Friends requires a signed-in account');
    }
    return auth;
  } catch (error: unknown) {
    if (error instanceof UnauthorizedError) {
      throw error;
    }
    throw error;
  }
}

function friendsHttpStatus(code: FriendsErrorCode): 400 | 401 | 403 | 404 | 409 | 429 {
  switch (code) {
    case 'FRIENDS_NOT_SIGNED_IN':
      return 401;
    case 'FRIENDS_BLOCKED':
    case 'FRIENDS_FORBIDDEN':
      return 403;
    case 'FRIENDS_NOT_FOUND':
      return 404;
    case 'FRIENDS_ALREADY_FRIENDS':
    case 'FRIENDS_REQUEST_EXISTS':
      return 409;
    case 'FRIENDS_COOLDOWN':
    case 'FRIENDS_SEARCH_RATE_LIMIT':
      return 429;
    default:
      return 400;
  }
}

function mapFriendsError(c: Context<ApiHonoEnv>, error: unknown): Response | null {
  if (error instanceof UnauthorizedError) {
    return c.json({ error: error.message, code: 'FRIENDS_NOT_SIGNED_IN' }, 401);
  }
  if (isFriendsError(error)) {
    return c.json(
      { error: error.message, code: error.code },
      friendsHttpStatus(error.code)
    );
  }
  return null;
}

async function withFriendsAuth(
  c: Context<ApiHonoEnv>,
  handler: (auth: AppAuth) => Promise<Response>
): Promise<Response> {
  try {
    const auth = await requireSignedInFriendsAuth(c);
    return await handler(auth);
  } catch (error: unknown) {
    const mapped = mapFriendsError(c, error);
    if (mapped !== null) return mapped;
    throw error;
  }
}

type SearchBody = { readonly query?: string; readonly limit?: number };
type SendRequestBody = { readonly toUserId?: string; readonly message?: string | null };
type BlockBody = { readonly userId?: string };

function readRequiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${field} is required`);
  }
  return value.trim();
}

export function createFriendsApp(): Hono<ApiHonoEnv> {
  const app = new Hono<ApiHonoEnv>();

  app.post('/friends/search', async (c) =>
    withFriendsAuth(c, async (auth) => {
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
    })
  );

  app.get('/friends/status/:userId', async (c) =>
    withFriendsAuth(c, async (auth) => {
      const targetUserId = readRequiredString(c.req.param('userId'), 'userId');
      const sql = c.get('sqlClient');
      const status: FriendshipStatus = await FriendService.resolveFriendshipStatus(
        sql,
        auth.myId,
        targetUserId
      );
      return c.json({ status });
    })
  );

  app.post('/friends/requests', async (c) =>
    withFriendsAuth(c, async (auth) => {
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
    })
  );

  app.post('/friends/requests/:id/accept', async (c) =>
    withFriendsAuth(c, async (auth) => {
      const requestId = readRequiredString(c.req.param('id'), 'id');
      const sql = c.get('sqlClient');
      const request = await FriendService.acceptFriendRequest(sql, auth.myId, requestId);
      return c.json({ request });
    })
  );

  app.post('/friends/requests/:id/decline', async (c) =>
    withFriendsAuth(c, async (auth) => {
      const requestId = readRequiredString(c.req.param('id'), 'id');
      const sql = c.get('sqlClient');
      const request = await FriendService.declineFriendRequest(sql, auth.myId, requestId);
      return c.json({ request });
    })
  );

  app.post('/friends/requests/:id/cancel', async (c) =>
    withFriendsAuth(c, async (auth) => {
      const requestId = readRequiredString(c.req.param('id'), 'id');
      const sql = c.get('sqlClient');
      const request = await FriendService.cancelFriendRequest(sql, auth.myId, requestId);
      return c.json({ request });
    })
  );

  app.delete('/friends/:userId', async (c) =>
    withFriendsAuth(c, async (auth) => {
      const friendUserId = readRequiredString(c.req.param('userId'), 'userId');
      const sql = c.get('sqlClient');
      await FriendService.removeFriend(sql, auth.myId, friendUserId);
      return c.json({ ok: true });
    })
  );

  app.post('/friends/blocks', async (c) =>
    withFriendsAuth(c, async (auth) => {
      const body = (await c.req.json()) as BlockBody;
      const userId = readRequiredString(body.userId, 'userId');
      const sql = c.get('sqlClient');
      await FriendService.blockUser(sql, auth.myId, userId);
      return c.json({ ok: true });
    })
  );

  app.delete('/friends/blocks/:userId', async (c) =>
    withFriendsAuth(c, async (auth) => {
      const userId = readRequiredString(c.req.param('userId'), 'userId');
      const sql = c.get('sqlClient');
      await FriendService.unblockUser(sql, auth.myId, userId);
      return c.json({ ok: true });
    })
  );

  app.get('/friends/mutual/:userId', async (c) =>
    withFriendsAuth(c, async (auth) => {
      const targetUserId = readRequiredString(c.req.param('userId'), 'userId');
      const sql = c.get('sqlClient');
      const friends = await FriendService.listMutualFriends(sql, auth.myId, targetUserId);
      return c.json({ friends });
    })
  );

  return app;
}
