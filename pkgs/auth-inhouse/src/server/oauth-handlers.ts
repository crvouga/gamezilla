/**
 * The OAuth round trip: launch → provider → callback → the app's callback URL.
 *
 * The callback always ends by redirecting to the app's own callback URL with
 * exactly one of `?code=` (exchange it at `POST /auth/session`), `?error=`
 * ({@link AUTH_ERROR}) or `?link_required=` (a pending link to confirm), so
 * the popup never strands the person on a JSON error page. Only a callback
 * whose `state` is unknown — where there is no trusted URL to go back to —
 * answers with JSON.
 */

import {
  AUTH_ERROR,
  type AuthErrorCode,
  isOauthProviderId,
  type OauthProviderId,
} from '@pkgs/auth/shared';
import type { Context } from 'hono';
import { AUTH_CALLBACK_PARAM } from '../shared/auth-constants';
import { isTrustedCallbackUrl } from '../shared/trusted-origins';
import { repo } from './auth-route-handlers';
import type { AuthAppCtx } from './create-auth-app-types';
import { IdentityLinker, type LinkOutcome } from './identity-linker';
import type { OauthStateRow } from './idp-repository';
import { PendingLinkRepository } from './pending-link-repository';
import type {
  OauthProviderAdapter,
  ProviderCallback,
} from './providers/provider-identity';

export function providerCallbackUri(
  baseURL: string,
  publicPathPrefix: string,
  provider: string
): string {
  const origin = baseURL.replace(/\/$/, '');
  const prefix = publicPathPrefix.replace(/\/$/, '');
  return `${origin}${prefix}/auth/callback/${provider}`;
}

/** The registered callback: the relay's when one is shared, else our own. */
function redirectUriOf(ctx: AuthAppCtx, provider: OauthProviderId): string {
  return providerCallbackUri(
    ctx.deps.callbackRelay?.callbackOrigin ?? ctx.deps.baseURL,
    ctx.deps.publicPathPrefix ?? '',
    provider
  );
}

function enabledProvider(
  ctx: AuthAppCtx,
  raw: string
):
  | OauthProviderAdapter
  | { readonly error: string; readonly status: 400 | 404 } {
  if (!isOauthProviderId(raw))
    return { error: 'unsupported_provider', status: 400 };
  return ctx.oauth.get(raw) ?? { error: 'provider_disabled', status: 404 };
}

/** What the launch is for, resolved from its one-time proofs. */
async function launchIntent(
  c: Context,
  ctx: AuthAppCtx
): Promise<{
  readonly intent: 'sign_in' | 'link';
  readonly linkUserId: string | null;
  readonly pendingLinkId: string | null;
} | null> {
  const ticket = c.req.query('linkTicket') ?? '';
  const pendingToken = c.req.query('pendingLink') ?? '';
  if (ticket.length > 0) {
    const userId = await repo(ctx.deps).consumeLinkTicket(ticket);
    return userId === null
      ? null
      : { intent: 'link', linkUserId: userId, pendingLinkId: null };
  }
  if (pendingToken.length > 0) {
    const pending = await new PendingLinkRepository(
      ctx.deps.getSql(),
      ctx.deps
    ).findByToken(pendingToken);
    return pending === null
      ? null
      : { intent: 'sign_in', linkUserId: null, pendingLinkId: pending.id };
  }
  return { intent: 'sign_in', linkUserId: null, pendingLinkId: null };
}

function callbackRedirect(
  c: Context,
  callbackUrl: string,
  params: Record<string, string>
): Response {
  const url = new URL(callbackUrl);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return c.redirect(url.toString(), 302);
}

export async function handleOauthLaunch(
  c: Context,
  ctx: AuthAppCtx
): Promise<Response> {
  const provider = enabledProvider(ctx, c.req.query('provider') ?? '');
  if ('error' in provider)
    return c.json({ error: provider.error }, provider.status);
  const callbackUrl = c.req.query('callbackUrl') ?? '';
  if (
    callbackUrl.length === 0 ||
    !isTrustedCallbackUrl(callbackUrl, ctx.deps.trustedOrigins)
  ) {
    return c.json({ error: 'invalid_callback_url' }, 400);
  }
  const intent = await launchIntent(c, ctx);
  if (intent === null) {
    return callbackRedirect(c, callbackUrl, {
      [AUTH_CALLBACK_PARAM.error]: AUTH_ERROR.expired,
    });
  }
  const { state, codeVerifier, nonce } = await repo(ctx.deps).createOauthState({
    provider: provider.id,
    callbackUrl,
    ...intent,
    stateTag: ctx.deps.callbackRelay?.stateTag ?? null,
  });
  const url = await provider.authorizationUrl({
    redirectUri: redirectUriOf(ctx, provider.id),
    state,
    codeVerifier,
    nonce,
  });
  return c.redirect(url, 302);
}

/** Query (Google) or form body (Apple `form_post`), as one flat map. */
async function callbackParams(c: Context): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const [key, value] of new URL(c.req.url).searchParams) out[key] = value;
  if (c.req.method === 'POST') {
    const body = await c.req.parseBody().catch(() => ({}));
    for (const [key, value] of Object.entries(body)) {
      if (typeof value === 'string') out[key] = value;
    }
  }
  return out;
}

/** The provider's own refusal codes, collapsed to what the app can act on. */
function providerErrorCode(raw: string): AuthErrorCode {
  return raw === 'access_denied' || raw === 'user_cancelled_authorize'
    ? AUTH_ERROR.cancelled
    : AUTH_ERROR.providerFailed;
}

function outcomeParams(outcome: LinkOutcome): Record<string, string> | null {
  if (outcome.kind === 'error') {
    return { [AUTH_CALLBACK_PARAM.error]: outcome.error };
  }
  if (outcome.kind === 'link_required') {
    return {
      [AUTH_CALLBACK_PARAM.linkRequired]: outcome.token,
      [AUTH_CALLBACK_PARAM.linkProviders]: outcome.providers.join(','),
      [AUTH_CALLBACK_PARAM.linkEmail]: outcome.email,
      [AUTH_CALLBACK_PARAM.linkProvider]: outcome.provider,
    };
  }
  return null;
}

async function resolveIdentity(args: {
  readonly ctx: AuthAppCtx;
  readonly provider: OauthProviderAdapter;
  readonly oauthState: OauthStateRow;
  readonly callback: ProviderCallback;
}): Promise<LinkOutcome> {
  const { ctx, provider, oauthState } = args;
  let identity: Awaited<ReturnType<OauthProviderAdapter['exchange']>>;
  try {
    identity = await provider.exchange({
      redirectUri: redirectUriOf(ctx, provider.id),
      callback: args.callback,
      codeVerifier: oauthState.code_verifier,
      nonce: oauthState.nonce,
    });
  } catch {
    return { kind: 'error', error: AUTH_ERROR.providerFailed };
  }
  return await ctx.deps.getSql().transaction(async (tx) => {
    const linker = new IdentityLinker(tx, ctx.deps);
    if (oauthState.intent === 'link' && oauthState.link_user_id !== null) {
      return await linker.link(oauthState.link_user_id, identity);
    }
    return await linker.signIn(identity, oauthState.pending_link_id);
  });
}

export async function handleOauthCallback(
  c: Context,
  ctx: AuthAppCtx
): Promise<Response> {
  const provider = enabledProvider(ctx, c.req.param('provider') ?? '');
  if ('error' in provider)
    return c.json({ error: provider.error }, provider.status);
  const params = await callbackParams(c);
  const r = repo(ctx.deps);
  const oauthState = await r.findOauthStateByState(params['state'] ?? '');
  if (oauthState === null || oauthState.provider !== provider.id) {
    return c.json({ error: 'invalid_state' }, 400);
  }
  const back = (extra: Record<string, string>): Response =>
    callbackRedirect(c, oauthState.callback_url, extra);
  const code = params['code'] ?? '';
  const providerError = params['error'] ?? '';
  if (providerError.length > 0 || code.length === 0) {
    await r.deleteOauthState(oauthState.id);
    return back({
      [AUTH_CALLBACK_PARAM.error]: providerErrorCode(providerError),
    });
  }
  const outcome = await resolveIdentity({
    ctx,
    provider,
    oauthState,
    callback: { code, user: params['user'] ?? null },
  });
  const failure = outcomeParams(outcome);
  if (failure !== null || outcome.kind !== 'signed_in') {
    await r.deleteOauthState(oauthState.id);
    return back(failure ?? {});
  }
  const exchangeCode = await r.attachExchangeCode({
    stateId: oauthState.id,
    userId: outcome.userId,
  });
  return back({ [AUTH_CALLBACK_PARAM.code]: exchangeCode });
}
