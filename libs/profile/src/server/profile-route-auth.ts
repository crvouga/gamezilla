import { UnauthorizedError } from '@libs/auth/server/unauthorized-error';
import type { ApiHonoEnv } from '@libs/auth/server/api-hono-env';
import { appAuth, type AppAuth } from '@libs/auth/shared/auth-context';
import type { Context } from 'hono';

import {
  isProfileError,
  type ProfileErrorCode,
} from '../shared/profile-errors';

async function requireProfileAuth(c: Context<ApiHonoEnv>): Promise<AppAuth> {
  const sessionAuth = c.get('sessionAuth');
  const sql = c.get('sqlClient');
  const ctx = await sessionAuth.resolveAuthContext(sql, c.req.raw);
  const auth = appAuth(ctx);
  if (auth === null || auth.myId.length === 0) {
    throw new UnauthorizedError('Profile requires an authenticated identity');
  }
  return auth;
}

export function writeFailureStatus(
  code: string
): 400 | 401 | 404 | 409 | 429 {
  switch (code as ProfileErrorCode) {
    case 'PROFILE_NOT_AUTHENTICATED':
      return 401;
    case 'PROFILE_NOT_FOUND':
      return 404;
    case 'PROFILE_USERNAME_TAKEN':
      return 409;
    case 'PROFILE_USERNAME_COOLDOWN':
      return 429;
    default:
      return 400;
  }
}

function mapProfileError(
  c: Context<ApiHonoEnv>,
  error: unknown
): Response | null {
  if (error instanceof UnauthorizedError) {
    return c.json(
      { error: error.message, code: 'PROFILE_NOT_AUTHENTICATED' },
      401
    );
  }
  if (isProfileError(error)) {
    return c.json(
      { error: error.message, code: error.code },
      writeFailureStatus(error.code)
    );
  }
  return null;
}

export async function withProfileAuth(
  c: Context<ApiHonoEnv>,
  handler: (auth: AppAuth) => Promise<Response>
): Promise<Response> {
  try {
    const auth = await requireProfileAuth(c);
    return await handler(auth);
  } catch (error: unknown) {
    const mapped = mapProfileError(c, error);
    if (mapped !== null) return mapped;
    throw error;
  }
}
