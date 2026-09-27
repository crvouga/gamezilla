/**
 * One OAuth round trip from the client's side: open the provider (from the
 * user's gesture, before any await), wait for the app callback, and read the
 * one thing it carries — a code to exchange, an error, or a pending link.
 */

import type { AuthSessionStore, SignInOptions } from '@pkgs/auth/client';
import { AUTH_ERROR, type OauthProviderId } from '@pkgs/auth/shared';
import type { Clock, Timers } from '@pkgs/clock';
import type { HttpFetch } from '@pkgs/http-client';
import {
  AUTH_NETWORK_ERROR,
  AUTH_SSO_CANCELLED_ERROR,
  AUTH_SSO_POPUP_BLOCKED_ERROR,
  apiUrl,
  buildOauthLaunchUrl,
  isPopupBlockedError,
  postJson,
  type SessionBody,
} from './auth-client-http';
import { type CallbackOutcome, readCallbackOutcome } from './auth-errors';
import type { AuthClientStorage, BearerTokenStore } from './bearer-token-store';

export type OpenAuthSessionResult = {
  readonly type: 'success' | 'cancel' | 'dismiss' | 'locked';
  readonly url?: string | null;
};

export type OpenAuthSession = (
  authorizationUrl: string,
  callbackUrl: string
) => Promise<OpenAuthSessionResult>;

export type AuthClientAdapterConfig = {
  readonly baseURL: string;
  readonly clock: Clock;
  readonly timers: Timers;
  readonly fetch: HttpFetch;
  readonly storage?: AuthClientStorage;
  readonly bearerStore?: BearerTokenStore;
  /** Required for OAuth providers; unused only when every strategy is stubbed. */
  readonly openAuthSession?: OpenAuthSession;
  /** Absolute client callback URL (e.g. https://app/sso-callback). */
  readonly callbackUrl?: string;
};

export type SignInCtx = {
  readonly config: AuthClientAdapterConfig;
  readonly bearerStore: BearerTokenStore;
  readonly callbackUrl: string;
  readonly session: AuthSessionStore;
};

async function signInHttpFailureMessage(res: Response): Promise<string> {
  let detail = '';
  try {
    const text = (await res.text()).trim();
    if (text.length > 0) {
      detail = text.length > 200 ? `${text.slice(0, 200)}…` : text;
    }
  } catch {
    // ignore body read failures
  }
  if (detail.length > 0) {
    return `${AUTH_NETWORK_ERROR} (${String(res.status)}: ${detail})`;
  }
  return `${AUTH_NETWORK_ERROR} (${String(res.status)})`;
}

export async function persistSessionFromResponse(
  ctx: SignInCtx,
  res: Response
): Promise<void> {
  ctx.bearerStore.captureFromResponse(res);
  if (!res.ok) {
    throw new Error(await signInHttpFailureMessage(res));
  }
  const body = (await res.json()) as SessionBody;
  if (typeof body.token === 'string' && body.token.length > 0) {
    await ctx.bearerStore.write(body.token);
  }
  await ctx.session.refresh();
}

export async function exchangeCode(
  ctx: SignInCtx,
  code: string
): Promise<void> {
  const res = await postJson(
    ctx.config.fetch,
    apiUrl(ctx.config.baseURL, '/auth/session'),
    { code }
  );
  await persistSessionFromResponse(ctx, res);
}

function blockedAware(err: unknown): never {
  if (isPopupBlockedError(err)) throw new Error(AUTH_SSO_POPUP_BLOCKED_ERROR);
  throw err;
}

/**
 * Open the provider and wait for the app callback. `beforeWait` runs after
 * the popup is open (so it may await) and before the result is awaited.
 */
export async function runOauthSession(
  ctx: SignInCtx,
  launchUrl: string,
  beforeWait: () => Promise<void> = async () => undefined
): Promise<CallbackOutcome> {
  const open = ctx.config.openAuthSession;
  if (open === undefined) {
    throw new Error('openAuthSession is required for OAuth sign-in');
  }
  // Open the auth session synchronously from the user gesture — no await first.
  let sessionPromise: Promise<OpenAuthSessionResult>;
  try {
    sessionPromise = open(launchUrl, ctx.callbackUrl);
  } catch (err) {
    return blockedAware(err);
  }
  await beforeWait();
  let result: OpenAuthSessionResult;
  try {
    result = await sessionPromise;
  } catch (err) {
    return blockedAware(err);
  }
  if (result.type === 'locked') throw new Error(AUTH_SSO_POPUP_BLOCKED_ERROR);
  if (result.type !== 'success' || result.url == null) return { kind: 'none' };
  return readCallbackOutcome(result.url);
}

/**
 * The callback's verdict as a thrown error, unless it carried a code. A
 * provider-side cancel keeps the historical "cancelled" message the sign-in
 * modal already recognises.
 */
export function codeOrThrow(outcome: CallbackOutcome): string {
  if (outcome.kind === 'code') return outcome.code;
  if (outcome.kind === 'none') throw new Error(AUTH_SSO_CANCELLED_ERROR);
  if (outcome.kind === 'error' && outcome.error.code === AUTH_ERROR.cancelled) {
    throw new Error(AUTH_SSO_CANCELLED_ERROR);
  }
  throw outcome.error;
}

export async function signInOauth(
  ctx: SignInCtx,
  provider: OauthProviderId,
  options: SignInOptions = {}
): Promise<void> {
  const launchUrl = buildOauthLaunchUrl({
    baseURL: ctx.config.baseURL,
    provider,
    callbackUrl: ctx.callbackUrl,
    pendingLink: options.pendingLink,
  });
  const outcome = await runOauthSession(ctx, launchUrl, () =>
    ctx.bearerStore.clear()
  );
  await exchangeCode(ctx, codeOrThrow(outcome));
}
