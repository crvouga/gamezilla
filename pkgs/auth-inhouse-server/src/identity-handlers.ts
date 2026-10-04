/**
 * The signed-in user's sign-in methods: list them, unlink one, mint the
 * ticket that authorizes linking another, or — when a sign-in parked an
 * identity behind an address match — decline linking and make it its own
 * account.
 */

import type { AuthIdentity } from '@pkgs/auth-shared/auth-identity';

import { AUTH_ERROR } from '@pkgs/auth-shared/auth-error-code';
import { isOauthProviderId } from '@pkgs/auth-shared/sign-in-method';
import type { OauthProviderId } from '@pkgs/auth-shared/sign-in-method';
import type { Context } from 'hono';
import {
  bearerUserId,
  identityRepo,
  readBearer,
  readStringField,
  repo,
  respondWithSession,
} from './auth-route-handlers';
import type { AuthAppCtx } from './create-auth-app-types';
import { IdentityLinker } from './identity-linker';
import { IdentityRepository } from './identity-repository';
import type { IdentityRow } from './identity-repository';
import { IdpRepository } from './idp-repository';
import { syncUserProfile } from './user-profile-sync';

export function identityJson(row: IdentityRow): AuthIdentity {
  return {
    provider: row.provider,
    providerUserId: row.providerUserId,
    email: row.email,
    emailVerified: row.emailVerified,
    isPrivateEmail: row.isPrivateEmail,
    emailForwarding: row.emailForwarding,
    name: row.name,
    linkedAt: row.linkedAt,
    lastSignInAt: row.lastSignInAt,
  };
}

function unauthorized(c: Context): Response {
  return c.json({ error: 'unauthorized' }, 401);
}

export async function handleListIdentities(
  c: Context,
  ctx: AuthAppCtx
): Promise<Response> {
  const userId = await bearerUserId(c, ctx.deps);
  if (userId === null) return unauthorized(c);
  const rows = await identityRepo(ctx.deps).listForUser(userId);
  return c.json({ identities: rows.map(identityJson) }, 200);
}

async function unlinkIn(
  ctx: AuthAppCtx,
  userId: string,
  provider: OauthProviderId
): Promise<{ removed: IdentityRow | null; left: IdentityRow[] } | 'last'> {
  return await ctx.deps.getSql().transaction(async (tx) => {
    const identities = new IdentityRepository(
      tx,
      ctx.deps.clock,
      ctx.deps.createId
    );
    const mine = await identities.listForUser(userId);
    const removed = mine.find((row) => row.provider === provider) ?? null;
    if (removed === null) return { removed, left: mine };
    if (mine.length <= 1) return 'last';
    await identities.remove(userId, provider);
    const users = new IdpRepository(
      tx,
      ctx.deps.clock,
      ctx.deps.createId,
      ctx.deps.secret
    );
    await syncUserProfile({ users, identities, userId });
    return { removed, left: mine.filter((row) => row !== removed) };
  });
}

/**
 * Remove one sign-in method. The last one cannot go — the account would be
 * unreachable. The provider is told the app gave the grant up (Apple
 * requires it), best effort: a provider outage must not block the unlink.
 */
export async function handleUnlink(
  c: Context,
  ctx: AuthAppCtx
): Promise<Response> {
  const userId = await bearerUserId(c, ctx.deps);
  if (userId === null) return unauthorized(c);
  const raw: unknown = await c.req.json().catch(() => null);
  const provider = readStringField(raw, 'provider');
  if (!isOauthProviderId(provider)) {
    return c.json({ error: 'unsupported_provider' }, 400);
  }
  const result = await unlinkIn(ctx, userId, provider);
  if (result === 'last') {
    return c.json({ error: AUTH_ERROR.lastIdentity }, 409);
  }
  const token = result.removed?.refreshToken ?? null;
  const revoked =
    token === null
      ? false
      : ((await ctx.oauth.get(provider)?.revoke(token)) ?? false);
  return c.json(
    {
      removed: result.removed !== null,
      providerRevoked: revoked,
      identities: result.left.map(identityJson),
    },
    200
  );
}

export async function handleLinkTicket(
  c: Context,
  ctx: AuthAppCtx
): Promise<Response> {
  const sessionToken = readBearer(c.req.header('authorization'));
  const userId = await bearerUserId(c, ctx.deps);
  if (userId === null || sessionToken === null) return unauthorized(c);
  const { ticket, expiresAtMs } = await repo(ctx.deps).createLinkTicket({
    userId,
    sessionToken,
  });
  return c.json(
    { ticket, expiresAt: new Date(expiresAtMs).toISOString() },
    200
  );
}

/** "Keep them separate": the parked identity becomes its own account. */
export async function handleCreateSeparate(
  c: Context,
  ctx: AuthAppCtx
): Promise<Response> {
  const raw: unknown = await c.req.json().catch(() => null);
  const token = readStringField(raw, 'token');
  if (token.length === 0) return c.json({ error: AUTH_ERROR.expired }, 400);
  const outcome = await ctx.deps
    .getSql()
    .transaction(async (tx) =>
      new IdentityLinker(tx, ctx.deps).createSeparate(token)
    );
  if (outcome.kind !== 'signed_in') {
    return c.json(
      { error: outcome.kind === 'error' ? outcome.error : AUTH_ERROR.expired },
      400
    );
  }
  return await respondWithSession(c, ctx.deps, outcome.userId);
}
