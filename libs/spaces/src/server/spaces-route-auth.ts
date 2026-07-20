import type { AppAuth } from '@libs/auth/shared/auth-context';
import { UnauthorizedError } from '@libs/auth/server/unauthorized-error';
import type { ApiHonoEnv } from '@libs/auth/server/api-hono-env';
import { appAuth } from '@libs/auth/shared/auth-context';
import type { Context } from 'hono';

import { isSpacesError, type SpacesErrorCode } from '../shared/spaces-errors';

async function requireDeviceAuth(c: Context<ApiHonoEnv>): Promise<AppAuth> {
  const sessionAuth = c.get('sessionAuth');
  const sql = c.get('sqlClient');
  const ctx = await sessionAuth.requireAuthContext(sql, c.req.raw);
  const auth = appAuth(ctx);
  if (auth === null) {
    throw new UnauthorizedError('Spaces requires a device identity');
  }
  return auth;
}

async function requireSignedInAuth(c: Context<ApiHonoEnv>): Promise<AppAuth> {
  const auth = await requireDeviceAuth(c);
  if (auth.accountId === null) {
    throw new UnauthorizedError('Spaces requires a signed-in account');
  }
  return auth;
}

const FORBIDDEN_CODES = new Set<SpacesErrorCode>([
  'SPACE_FORBIDDEN',
  'SPACE_VISIBILITY_DENIED',
  'SPACE_HOST_ALREADY_MEMBER',
]);

const BAD_REQUEST_CODES = new Set<SpacesErrorCode>([
  'SPACE_ENDED',
  'SPACE_INVITE_INVALID',
  'SPACE_INVITE_EXPIRED',
  'SPACE_INVITE_REVOKED',
  'SPACE_INVITE_EXHAUSTED',
  'SPACE_INVALID_INPUT',
]);

function spacesHttpStatus(code: SpacesErrorCode): 400 | 401 | 403 | 404 {
  if (code === 'SPACE_NOT_SIGNED_IN') return 401;
  if (FORBIDDEN_CODES.has(code)) return 403;
  if (code === 'SPACE_NOT_FOUND') return 404;
  if (BAD_REQUEST_CODES.has(code)) return 400;
  return 400;
}

export function mapSpacesError(
  c: Context<ApiHonoEnv>,
  error: unknown
): Response | null {
  if (error instanceof UnauthorizedError) {
    return c.json({ error: error.message, code: 'SPACE_NOT_SIGNED_IN' }, 401);
  }
  if (isSpacesError(error)) {
    return c.json(
      { error: error.message, code: error.code },
      spacesHttpStatus(error.code)
    );
  }
  return null;
}

export async function withSpacesSignedInAuth(
  c: Context<ApiHonoEnv>,
  handler: (auth: AppAuth & { readonly accountId: string }) => Promise<Response>
): Promise<Response> {
  try {
    const auth = await requireSignedInAuth(c);
    return await handler({ ...auth, accountId: auth.accountId as string });
  } catch (error: unknown) {
    const mapped = mapSpacesError(c, error);
    if (mapped !== null) return mapped;
    throw error;
  }
}
