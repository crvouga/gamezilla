import type { Context } from 'hono';

import { AUTH_SET_TOKEN_HEADER } from '../shared/auth-constants';
import type { AuthAppCtx, CreateAuthAppDeps } from './create-auth-app-types';
import { IdentityRepository } from './identity-repository';
import { IdpRepository } from './idp-repository';

type SessionUserJson = {
  readonly id: string;
  readonly email: string | null;
  readonly name: string | null;
  readonly image: string | null;
};

export function sessionJson(
  user: SessionUserJson,
  token: string,
  expiresAtMs: number,
  authenticatedAtMs: number
): {
  readonly token: string;
  readonly expiresAt: string;
  readonly authenticatedAt: string;
  readonly user: SessionUserJson;
} {
  return {
    token,
    expiresAt: new Date(expiresAtMs).toISOString(),
    authenticatedAt: new Date(authenticatedAtMs).toISOString(),
    user,
  };
}

export function readBearer(header: string | undefined): string | null {
  if (header === undefined) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (match === null) return null;
  const token = match[1]?.trim() ?? '';
  return token.length > 0 ? token : null;
}

export function repo(deps: CreateAuthAppDeps): IdpRepository {
  return new IdpRepository(
    deps.getSql(),
    deps.clock,
    deps.createId,
    deps.secret
  );
}

export function identityRepo(deps: CreateAuthAppDeps): IdentityRepository {
  return new IdentityRepository(deps.getSql(), deps.clock, deps.createId);
}

export function readStringField(raw: unknown, key: string): string {
  if (raw === null || typeof raw !== 'object') return '';
  const value = (raw as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : '';
}

/** The signed-in user behind the request's bearer, or `null`. */
export async function bearerUserId(
  c: Context,
  deps: CreateAuthAppDeps
): Promise<string | null> {
  const token = readBearer(c.req.header('authorization'));
  if (token === null) return null;
  const found = await repo(deps).findSessionByToken(token);
  return found?.user.id ?? null;
}

/** Mint a session for `userId` and answer the way `/auth/session` does. */
export async function respondWithSession(
  c: Context,
  deps: CreateAuthAppDeps,
  userId: string
): Promise<Response> {
  const r = repo(deps);
  const user = await r.findUserById(userId);
  if (user === null) {
    return c.json({ error: 'user_missing' }, 400);
  }
  const session = await r.createSession(userId);
  c.header(AUTH_SET_TOKEN_HEADER, session.token);
  return c.json(sessionJson(user, session.token, session.expiresAtMs, deps.clock.now()), 200);
}

export async function handleSessionExchange(
  c: Context,
  ctx: AuthAppCtx
): Promise<Response> {
  const raw: unknown = await c.req.json().catch(() => null);
  const code = readStringField(raw, 'code');
  if (code.length === 0) {
    return c.json({ error: 'missing_code' }, 400);
  }
  const userId = await repo(ctx.deps).consumeExchangeCode(code);
  if (userId === null) {
    return c.json({ error: 'invalid_code' }, 400);
  }
  return await respondWithSession(c, ctx.deps, userId);
}

export async function handleGetSession(
  c: Context,
  ctx: AuthAppCtx
): Promise<Response> {
  const token = readBearer(c.req.header('authorization'));
  if (token === null) {
    return c.json({ error: 'unauthorized' }, 401);
  }
  const found = await repo(ctx.deps).findSessionByToken(token);
  if (found === null) {
    return c.json({ error: 'unauthorized' }, 401);
  }
  return c.json(
    {
      user: found.user,
      expiresAt: found.session.expires_at,
      authenticatedAt: found.session.created_at,
    },
    200
  );
}

export async function handleSignOut(
  c: Context,
  ctx: AuthAppCtx
): Promise<Response> {
  const token = readBearer(c.req.header('authorization'));
  if (token !== null) {
    await repo(ctx.deps).deleteSessionByToken(token);
  }
  return c.json({ ok: true }, 200);
}

/** Revoke every session the user holds, on every device. */
export async function handleSignOutAll(
  c: Context,
  ctx: AuthAppCtx
): Promise<Response> {
  const userId = await bearerUserId(c, ctx.deps);
  if (userId === null) {
    return c.json({ error: 'unauthorized' }, 401);
  }
  await repo(ctx.deps).deleteSessionsForUser(userId);
  return c.json({ ok: true }, 200);
}
