/**
 * Sign in with a link sent by email.
 *
 * `POST /auth/email/request` mints a one-time link and hands it to the host
 * to mail; `POST /auth/email/confirm` spends it. Opening the link proves the
 * person controls the mailbox, so the identity it yields is the address
 * itself, verified — and it goes through the same linking policy a provider
 * callback does ({@link IdentityLinker.signIn}).
 *
 * A request answers the same whether or not anything was mailed: it never
 * says whether an account exists, or whether the host serves the address.
 */

import { AUTH_CALLBACK_PARAM } from '@pkgs/auth-inhouse-shared-ts/auth-constants';
import { isTrustedCallbackUrl } from '@pkgs/auth-inhouse-shared-ts/trusted-origins';
import { AUTH_ERROR } from '@pkgs/auth-root-shared-ts/auth-error-code';
import type { Context } from 'hono';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { readStringField, respondWithSession } from './auth-route-handlers';
import type { CreateAuthAppDeps } from './create-auth-app-types';
import { normalizeEmailAddress } from './email-link-delivery';
import { EmailLinkRepository } from './email-link-repository';
import { IdentityLinker } from './identity-linker';
import { outcomeParams } from './oauth-handlers';
import { PendingLinkRepository } from './pending-link-repository';
import type { ProviderIdentity } from './provider-identity';

const TOKEN_MAX_LENGTH = 256;
const BODY_MAX_BYTES = 4096;

type LinkRequest = {
  readonly email: string;
  /** Where the link opens; `null` → the link is the bare token. */
  readonly callbackUrl: string | null;
  readonly pendingLink: string | null;
};

type Refusal = { readonly error: string };

/** A browser names its origin; only the app's own may call these routes. */
function fromTrustedOrigin(c: Context, deps: CreateAuthAppDeps): boolean {
  const origin = c.req.header('origin');
  return origin === undefined || deps.trustedOrigins.includes(origin);
}

/** An optional string field: `null` when absent, `undefined` when unusable. */
function optionalField(raw: unknown, key: string): string | null | undefined {
  if (raw === null || typeof raw !== 'object') return null;
  const value = (raw as Record<string, unknown>)[key];
  if (value === undefined || value === null) return null;
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

async function readLinkRequest(
  c: Context,
  deps: CreateAuthAppDeps
): Promise<LinkRequest | Refusal> {
  if (!fromTrustedOrigin(c, deps)) return { error: 'untrusted_origin' };
  const raw: unknown = await c.req.json().catch(() => null);
  const email = normalizeEmailAddress(readStringField(raw, 'email'));
  if (email === null) return { error: 'invalid_email' };
  const callbackUrl = optionalField(raw, 'callbackUrl');
  if (
    callbackUrl === undefined ||
    (callbackUrl !== null &&
      !isTrustedCallbackUrl(callbackUrl, deps.trustedOrigins))
  ) {
    return { error: 'invalid_callback_url' };
  }
  const pendingLink = optionalField(raw, 'pendingLink');
  if (
    pendingLink === undefined ||
    (pendingLink !== null && pendingLink.length > TOKEN_MAX_LENGTH)
  ) {
    return { error: 'invalid_request' };
  }
  return { email, callbackUrl, pendingLink };
}

/** The app's callback URL carrying the token, as an OAuth return carries a code. */
function linkFor(callbackUrl: string | null, token: string): string {
  if (callbackUrl === null) return token;
  const url = new URL(callbackUrl);
  url.searchParams.set(AUTH_CALLBACK_PARAM.emailLink, token);
  return url.toString();
}

/** What an opened link proves: the person controls this mailbox. */
function mailboxIdentity(email: string): ProviderIdentity {
  return {
    provider: 'email',
    providerUserId: email,
    email,
    emailVerified: true,
    isPrivateEmail: false,
    name: null,
    picture: null,
    accessToken: null,
    refreshToken: null,
  };
}

async function handleRequest(
  c: Context,
  deps: CreateAuthAppDeps
): Promise<Response> {
  const emailLinks = deps.emailLinks;
  if (emailLinks === undefined) return c.json({ error: 'not_found' }, 404);
  const input = await readLinkRequest(c, deps);
  if ('error' in input) return c.json(input, 400);
  const db = deps.getSql();
  const links = new EmailLinkRepository(db, deps);
  // Counted per address before anything depends on the address being served.
  if (!(await links.admit(input.email))) {
    return c.json({ error: 'try_later' }, 429);
  }
  // A dead pending link is refused here, as an OAuth launch refuses it —
  // and before `accepts`, so the answer says nothing about the address.
  let pendingLinkId: string | null = null;
  if (input.pendingLink !== null) {
    const pending = await new PendingLinkRepository(db, deps).findByToken(
      input.pendingLink
    );
    if (pending === null) return c.json({ error: AUTH_ERROR.expired }, 409);
    pendingLinkId = pending.id;
  }
  if (emailLinks.accepts(input.email)) {
    const { token, expiresAtMs } = await links.mint({
      email: input.email,
      pendingLinkId,
    });
    await emailLinks.deliver({
      email: input.email,
      link: linkFor(input.callbackUrl, token),
      token,
      expiresAt: expiresAtMs,
    });
  }
  return c.json({}, 202);
}

async function handleConfirm(
  c: Context,
  deps: CreateAuthAppDeps
): Promise<Response> {
  if (deps.emailLinks === undefined) return c.json({ error: 'not_found' }, 404);
  if (!fromTrustedOrigin(c, deps)) {
    return c.json({ error: 'untrusted_origin' }, 400);
  }
  const raw: unknown = await c.req.json().catch(() => null);
  const token = readStringField(raw, 'token');
  const spendable = token.length > 0 && token.length <= TOKEN_MAX_LENGTH;
  // Spending the link and acting on it commit together; a link whose sign-in
  // the linking policy refuses is spent all the same.
  const outcome = !spendable
    ? null
    : await deps.getSql().transaction(async (tx) => {
        const link = await new EmailLinkRepository(tx, deps).consume(token);
        if (link === null) return null;
        return await new IdentityLinker(tx, deps).signIn(
          mailboxIdentity(link.email),
          link.pendingLinkId
        );
      });
  if (outcome === null) return c.json({ error: AUTH_ERROR.expired }, 401);
  if (outcome.kind !== 'signed_in') {
    return c.json(outcomeParams(outcome) ?? {}, 409);
  }
  return await respondWithSession(c, deps, outcome.userId);
}

/** The email sign-in routes, mounted at `/auth/email`. */
export function createEmailLinkAuthApp(deps: CreateAuthAppDeps): Hono {
  return new Hono()
    .use('*', bodyLimit({ maxSize: BODY_MAX_BYTES }))
    .post('/request', (c) => handleRequest(c, deps))
    .post('/confirm', (c) => handleConfirm(c, deps));
}
