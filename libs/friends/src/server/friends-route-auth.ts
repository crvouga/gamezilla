import { UnauthorizedError } from '@libs/auth/server/unauthorized-error';
import type { ApiHonoEnv } from '@libs/auth/server/api-hono-env';
import { appAuth, type AppAuth } from '@libs/auth/shared/auth-context';
import type { Context } from 'hono';

import {
  isFriendsError,
  type FriendsErrorCode,
} from '../shared/friends-errors';

async function requireSignedInFriendsAuth(
  c: Context<ApiHonoEnv>
): Promise<AppAuth> {
  const sessionAuth = c.get('sessionAuth');
  const sql = c.get('sqlClient');
  const ctx = await sessionAuth.requireAuthContext(sql, c.req.raw);
  const auth = appAuth(ctx);
  if (auth === null || auth.accountId === null) {
    throw new UnauthorizedError('Friends requires a signed-in account');
  }
  return auth;
}

function friendsHttpStatus(
  code: FriendsErrorCode
): 400 | 401 | 403 | 404 | 409 | 429 {
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

function mapFriendsError(
  c: Context<ApiHonoEnv>,
  error: unknown
): Response | null {
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

export async function withFriendsAuth(
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
