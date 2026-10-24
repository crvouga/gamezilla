/**
 * Synthetic-monitor sign-in: how the production synthetic journeys hold a
 * real session without driving a human identity provider.
 *
 * Google (like every real IdP) cannot be scripted headlessly, so the monitor
 * proves possession of a long random secret instead. Only the runner holds
 * it — it never reaches a browser. In exchange it gets a one-time exchange
 * code for a fresh dedicated monitoring user, bound to a trusted callback URL, exactly what
 * a provider callback would have produced. The browser then walks the same
 * `/sso-callback?code=` → `POST /auth/session` path a Google sign-in ends in.
 *
 * Safety properties:
 * - Unconfigured (no token) → the route answers 404, as if it did not exist.
 * - The token is compared as peppered hashes in constant time.
 * - Without a continuation, the server mints a fresh user in a reserved namespace.
 *   A server-signed, short-lived continuation joins another device to that
 *   monitor account. The caller cannot name an existing or real user.
 * - The callback URL must be trusted, like any OAuth launch.
 * - The provider is hidden: never in `/auth/providers`, never a sign-in button.
 */

import { AUTH_CALLBACK_PARAM } from '@pkgs/auth-inhouse-shared-ts/auth-constants';
import { hashAuthSecret } from '@pkgs/auth-inhouse-shared-ts/token-hash';
import { isTrustedCallbackUrl } from '@pkgs/auth-inhouse-shared-ts/trusted-origins';
import type { Context } from 'hono';
import { readBearer, readStringField, repo } from './auth-route-handlers';
import type { AuthAppCtx } from './create-auth-app-types';
import {
  createMonitorContinuation,
  readMonitorContinuation,
} from './synthetic-monitor-continuation';

export type SyntheticMonitorConfig = {
  /** Shared secret the synthetic runner presents as a bearer token. */
  readonly token: string;
};

/** Real identities use generated ids, never this reserved namespace. */
const MONITOR_NAMESPACE = 'synthetic-monitor:';
export function isSyntheticMonitor(id: string): boolean {
  return id.startsWith(MONITOR_NAMESPACE);
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

async function monitorUser(
  ctx: AuthAppCtx,
  raw: unknown,
  callbackUrl: string
): Promise<string | null> {
  const r = repo(ctx.deps);
  if (
    raw !== null &&
    typeof raw === 'object' &&
    Reflect.has(raw, 'continuationToken')
  ) {
    const token = readStringField(raw, 'continuationToken');
    const id = await readMonitorContinuation(ctx, token, callbackUrl);
    if (id === null || !isSyntheticMonitor(id)) return null;
    return (await r.findUserById(id)) === null ? null : id;
  }
  const id = `${MONITOR_NAMESPACE}${ctx.deps.createId()}`;
  const peer =
    raw !== null &&
    typeof raw === 'object' &&
    Reflect.get(raw, 'peer') === true;
  await r.insertUser({
    id,
    email: null,
    name: peer ? 'Synthetic Monitor Peer' : 'Synthetic Monitor',
    image: null,
  });
  return id;
}

/**
 * `POST /auth/synthetic-monitor/code` with `Authorization: Bearer <token>`
 * and a trusted callback → a single-use redirect and a short-lived continuation
 * kept by the runner for another device within this journey.
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
  const userId = await monitorUser(ctx, raw, callbackUrl);
  if (userId === null)
    return c.json({ error: 'invalid_monitor_continuation' }, 400);
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
    userId,
  });
  const redirect = new URL(callbackUrl);
  redirect.searchParams.set(AUTH_CALLBACK_PARAM.code, code);
  return c.json(
    {
      redirectUrl: redirect.toString(),
      continuationToken: await createMonitorContinuation(
        ctx,
        userId,
        callbackUrl
      ),
    },
    200
  );
}
