/**
 * `POST /auth/apple/notifications` — Apple telling us the account holder did
 * something outside the app. Unauthenticated by transport, so the payload's
 * signature *is* the authentication; a replayed `jti` is acknowledged and
 * ignored.
 *
 * - `consent-revoked` — "Stop using Apple Account" with this app: treated as
 *   a sign-out everywhere. The identity stays linked, so signing in with
 *   Apple again returns to the same account.
 * - `account-delete` — the Apple Account is gone for good: its identity is
 *   removed; a user left with no identity is signed out everywhere.
 * - `email-disabled` / `email-enabled` — relay forwarding switched off / on.
 */

import type { Context } from 'hono';

import { IDP_PROVIDER_APPLE } from '../shared/auth-constants';
import type { AuthAppCtx } from './create-auth-app-types';
import { IdentityRepository } from './identity-repository';
import { IdpRepository } from './idp-repository';
import {
  type AppleNotification,
  verifyAppleNotification,
} from './providers/apple-notifications';
import { syncUserProfile } from './user-profile-sync';

async function apply(
  ctx: AuthAppCtx,
  event: AppleNotification
): Promise<'applied' | 'replayed' | 'unknown_identity'> {
  return await ctx.deps.getSql().transaction(async (tx) => {
    const { clock, createId, secret } = ctx.deps;
    const identities = new IdentityRepository(tx, clock, createId);
    const users = new IdpRepository(tx, clock, createId, secret);
    const seen = await identities.seenEvent({
      provider: IDP_PROVIDER_APPLE,
      jti: event.jti,
      type: event.type,
      providerUserId: event.sub,
    });
    if (seen) return 'replayed';
    const identity = await identities.find(IDP_PROVIDER_APPLE, event.sub);
    if (identity === null) return 'unknown_identity';
    if (event.type === 'consent-revoked') {
      await users.deleteSessionsForUser(identity.userId);
    } else if (event.type === 'account-delete') {
      await identities.removeIdentity(IDP_PROVIDER_APPLE, event.sub);
      const left = await identities.listForUser(identity.userId);
      if (left.length === 0) await users.deleteSessionsForUser(identity.userId);
      else
        await syncUserProfile({ users, identities, userId: identity.userId });
    } else {
      await identities.setForwarding(
        IDP_PROVIDER_APPLE,
        event.sub,
        event.type === 'email-enabled'
      );
    }
    return 'applied';
  });
}

export async function handleAppleNotification(
  c: Context,
  ctx: AuthAppCtx
): Promise<Response> {
  const apple = ctx.oauth.apple;
  if (apple === null) return c.json({ error: 'provider_disabled' }, 404);
  const raw: unknown = await c.req.json().catch(() => null);
  const payload =
    raw !== null && typeof raw === 'object'
      ? (raw as Record<string, unknown>)['payload']
      : undefined;
  if (typeof payload !== 'string') {
    return c.json({ error: 'invalid_payload' }, 400);
  }
  let event: AppleNotification;
  try {
    event = await verifyAppleNotification(apple, payload);
  } catch {
    return c.json({ error: 'invalid_signature' }, 401);
  }
  const result = await apply(ctx, event);
  // Apple retries non-2xx deliveries; an identity we never linked is not a
  // failure worth retrying.
  return c.json({ ok: true, result }, 200);
}
