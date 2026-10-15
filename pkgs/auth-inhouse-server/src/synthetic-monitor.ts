/**
 * Synthetic-monitor sign-in: how the production synthetic journeys hold a
 * real session without driving a human identity provider.
 *
 * Google (like every real IdP) cannot be scripted headlessly, so the monitor
 * proves possession of a long random secret instead. Only the runner holds
 * it — it never reaches a browser. In exchange it gets a one-time exchange
 * code for **one of two fixed monitoring users**, bound to a trusted callback URL, exactly what
 * a provider callback would have produced. The browser then walks the same
 * `/sso-callback?code=` → `POST /auth/session` path a Google sign-in ends in.
 *
 * Safety properties:
 * - Unconfigured (no token) → the route answers 404, as if it did not exist.
 * - The token is compared as peppered hashes in constant time.
 * - The caller cannot choose the user: both ids are fixed here, so the secret
 *   can never mint a session for a real person.
 * - The callback URL must be trusted, like any OAuth launch.
 * - The provider is hidden: never in `/auth/providers`, never a sign-in button.
 */

import { AUTH_CALLBACK_PARAM } from '@pkgs/auth-inhouse-shared/auth-constants';
import { hashAuthSecret } from '@pkgs/auth-inhouse-shared/token-hash';
import { isTrustedCallbackUrl } from '@pkgs/auth-inhouse-shared/trusted-origins';
import type { Context } from 'hono';
import { readBearer, readStringField, repo } from './auth-route-handlers';
import type { AuthAppCtx } from './create-auth-app-types';

export type SyntheticMonitorConfig = {
  /** Shared secret the synthetic runner presents as a bearer token. */
  readonly token: string;
};

/** The primary account synthetic journeys act as. UUID-shaped like every user id. */
export const SYNTHETIC_MONITOR_USER = {
  id: '5e7e71c0-0000-4000-8000-00000000c0de',
  name: 'Synthetic Monitor',
} as const;

export const SYNTHETIC_MONITOR_PEER = {
  id: '5e7e71c0-0000-4000-8000-00000000c0df',
  name: 'Synthetic Monitor Peer',
} as const;
export function isSyntheticMonitor(id: string): boolean {
  return id === SYNTHETIC_MONITOR_USER.id || id === SYNTHETIC_MONITOR_PEER.id;
}
/** OAuth-state provider tag for monitor sign-ins (never an `OauthProviderId`). */
export const SYNTHETIC_MONITOR_PROVIDER = 'synthetic-monitor';

/** Equal-length hex digests compared without an early exit. */
function digestsEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function presentedTokenMatches(ctx: AuthAppCtx, presented: string): boolean {
  const expected = ctx.deps.syntheticMonitor?.token ?? '';
  if (expected.length === 0) return false;
  return digestsEqual(
    hashAuthSecret(ctx.deps.secret, presented),
    hashAuthSecret(ctx.deps.secret, expected)
  );
}

async function ensureMonitorUser(
  ctx: AuthAppCtx,
  user: typeof SYNTHETIC_MONITOR_USER | typeof SYNTHETIC_MONITOR_PEER
): Promise<void> {
  const r = repo(ctx.deps);
  if ((await r.findUserById(user.id)) !== null) return;
  await r.insertUser({
    id: user.id,
    email: null,
    name: user.name,
    image: null,
  });
}

/**
 * `POST /auth/synthetic-monitor/code` with `Authorization: Bearer <token>`
 * and `{ "callbackUrl": "https://www…/sso-callback" }` →
 * `{ "redirectUrl": "<callbackUrl>?code=<one-time exchange code>" }`.
 */
export async function handleSyntheticMonitorCode(
  c: Context,
  ctx: AuthAppCtx
): Promise<Response> {
  if (ctx.deps.syntheticMonitor === undefined) {
    return c.json({ error: 'not_found' }, 404);
  }
  const presented = readBearer(c.req.header('authorization'));
  if (presented === null || !presentedTokenMatches(ctx, presented)) {
    return c.json({ error: 'unauthorized' }, 401);
  }
  const raw: unknown = await c.req.json().catch(() => null);
  const callbackUrl = readStringField(raw, 'callbackUrl');
  if (
    callbackUrl.length === 0 ||
    !isTrustedCallbackUrl(callbackUrl, ctx.deps.trustedOrigins)
  ) {
    return c.json({ error: 'invalid_callback_url' }, 400);
  }
  const user =
    raw !== null && typeof raw === 'object' && Reflect.get(raw, 'peer') === true
      ? SYNTHETIC_MONITOR_PEER
      : SYNTHETIC_MONITOR_USER;
  await ensureMonitorUser(ctx, user);
  const r = repo(ctx.deps);
  const { state } = await r.createOauthState({
    provider: SYNTHETIC_MONITOR_PROVIDER,
    callbackUrl,
    intent: 'sign_in',
    linkUserId: null,
    pendingLinkId: null,
    // Never leaves this deployment: no provider round trip to relay.
    stateTag: null,
  });
  const oauthState = await r.findOauthStateByState(state);
  if (oauthState === null) {
    return c.json({ error: 'state_missing' }, 500);
  }
  const code = await r.attachExchangeCode({
    stateId: oauthState.id,
    userId: user.id,
  });
  const redirect = new URL(callbackUrl);
  redirect.searchParams.set(AUTH_CALLBACK_PARAM.code, code);
  return c.json({ redirectUrl: redirect.toString() }, 200);
}
