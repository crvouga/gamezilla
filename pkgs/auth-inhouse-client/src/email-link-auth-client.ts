/**
 * Signing in with an emailed link, from the client's side: ask for the link,
 * then spend the one that arrives — opened in this app (the callback route),
 * or pasted in as the whole link or its bare token.
 */

import { AUTH_CALLBACK_PARAM } from '@pkgs/auth-inhouse-shared/auth-constants';
import type { SignInOptions } from '@pkgs/auth-root-shared/auth-client-port';
import { apiUrl, postJson } from './auth-client-http';
import type { SignInCtx } from './auth-client-oauth';
import { persistSessionFromResponse } from './auth-client-oauth';
import { readOutcomeParams } from './auth-errors';

export const AUTH_EMAIL_LINK_INVALID_ADDRESS_ERROR =
  'Enter a valid email address.';
export const AUTH_EMAIL_LINK_THROTTLED_ERROR =
  'Too many attempts. Try again later.';
export const AUTH_EMAIL_LINK_UNAVAILABLE_ERROR =
  'Signing in by email is not available.';
export const AUTH_EMAIL_LINK_FAILED_ERROR =
  'Signing in by email did not go through.';

const HTTP_NOT_FOUND = 404;
const HTTP_TOO_MANY_REQUESTS = 429;

/** The body's string fields, read the way the callback's query is. */
function bodyParams(body: unknown): URLSearchParams {
  const params = new URLSearchParams();
  if (body === null || typeof body !== 'object') return params;
  for (const [key, value] of Object.entries(body)) {
    if (typeof value === 'string') params.set(key, value);
  }
  return params;
}

/** Why the service refused, as the error the UI already knows how to show. */
async function refusal(res: Response): Promise<Error> {
  const params = bodyParams(await res.json().catch(() => null));
  const outcome = readOutcomeParams(params);
  if (outcome.kind === 'error' || outcome.kind === 'link_required') {
    return outcome.error;
  }
  if (res.status === HTTP_NOT_FOUND) {
    return new Error(AUTH_EMAIL_LINK_UNAVAILABLE_ERROR);
  }
  if (res.status === HTTP_TOO_MANY_REQUESTS) {
    return new Error(AUTH_EMAIL_LINK_THROTTLED_ERROR);
  }
  if (params.get('error') === 'invalid_email') {
    return new Error(AUTH_EMAIL_LINK_INVALID_ADDRESS_ERROR);
  }
  return new Error(AUTH_EMAIL_LINK_FAILED_ERROR);
}

/** Ask for a link; it opens this app's callback URL. */
export async function requestEmailLink(
  ctx: SignInCtx,
  email: string,
  options: SignInOptions = {}
): Promise<void> {
  const res = await postJson(
    ctx.config.fetch,
    apiUrl(ctx.config.baseURL, '/auth/email/request'),
    {
      email,
      callbackUrl: ctx.callbackUrl,
      ...(options.pendingLink === undefined
        ? {}
        : { pendingLink: options.pendingLink }),
    }
  );
  if (!res.ok) throw await refusal(res);
}

/** The token an emailed link carries, or `null` when `url` carries none. */
export function emailLinkTokenIn(url: string): string | null {
  try {
    const token = new URL(url).searchParams.get(AUTH_CALLBACK_PARAM.emailLink);
    return token !== null && token.length > 0 ? token : null;
  } catch {
    return null;
  }
}

/**
 * Spend a link — the whole link or its bare token — and persist the session
 * it yields. The session the device held before is retired once replaced, so
 * no orphan bearer stays valid for its whole lifetime.
 */
export async function signInWithEmailLink(
  ctx: SignInCtx,
  link: string
): Promise<void> {
  const pasted = link.trim();
  const token = emailLinkTokenIn(pasted) ?? pasted;
  const previous = await ctx.bearerStore.read();
  const res = await postJson(
    ctx.config.fetch,
    apiUrl(ctx.config.baseURL, '/auth/email/confirm'),
    { token }
  );
  if (!res.ok) throw await refusal(res);
  await persistSessionFromResponse(ctx, res);
  await retireReplacedSession(ctx, previous);
}

/** Sign the previous bearer out once a fresh sign-in has taken its place. */
export async function retireReplacedSession(
  ctx: SignInCtx,
  previous: string | null
): Promise<void> {
  if (previous === null || previous === (await ctx.bearerStore.read())) return;
  await postJson(
    ctx.config.fetch,
    apiUrl(ctx.config.baseURL, '/auth/sign-out'),
    {},
    previous
  );
}
