import type { Context } from 'hono';

import {
  IDP_PROVIDER_APPLE,
  IDP_PROVIDER_GOOGLE,
} from '../shared/auth-constants';
import { verifyAppleIdToken } from './apple-oauth';
import type { CreateAuthAppDeps } from './create-auth-app-types';
import { exchangeGoogleAuthorizationCode } from './google-oauth';
import { IdpRepository } from './idp-repository';

type SessionUserJson = {
  readonly id: string;
  readonly email: string | null;
  readonly name: string | null;
  readonly image: string | null;
};

type OauthStateRow = {
  readonly id: string;
  readonly callback_url: string;
  readonly code_verifier: string;
  readonly user_id: string | null;
};

function repo(deps: CreateAuthAppDeps): IdpRepository {
  return new IdpRepository(
    deps.getSql(),
    deps.clock,
    deps.createId,
    deps.secret
  );
}

function publicPrefix(deps: CreateAuthAppDeps): string {
  return deps.publicPathPrefix ?? '';
}

export async function finishOauthCallback(args: {
  readonly c: Context;
  readonly deps: CreateAuthAppDeps;
  readonly oauthState: { readonly id: string; readonly callback_url: string };
  readonly user: SessionUserJson;
}): Promise<Response> {
  const exchangeCode = await repo(args.deps).attachExchangeCode({
    stateId: args.oauthState.id,
    userId: args.user.id,
  });
  const redirect = new URL(args.oauthState.callback_url);
  redirect.searchParams.set('code', exchangeCode);
  return args.c.redirect(redirect.toString(), 302);
}

async function resolveProviderUser(
  r: IdpRepository,
  args: {
    readonly provider: string;
    readonly providerUserId: string;
    readonly email: string | null;
    readonly name: string | null;
    readonly image: string | null;
    readonly accessToken?: string | null;
    readonly refreshToken?: string | null;
    readonly linkUserId: string | null;
  }
): Promise<SessionUserJson | null> {
  const existing = await r.findAccountUserId(
    args.provider,
    args.providerUserId
  );
  if (args.linkUserId !== null) {
    if (existing !== null && existing !== args.linkUserId) return null;
    if (existing === null) {
      await r.attachAccount({
        userId: args.linkUserId,
        provider: args.provider,
        providerUserId: args.providerUserId,
        accessToken: args.accessToken,
        refreshToken: args.refreshToken,
      });
    }
    return r.findUserById(args.linkUserId);
  }
  return r.upsertSocialUser(args);
}

async function finishLinkedUser(
  c: Context,
  deps: CreateAuthAppDeps,
  oauthState: OauthStateRow,
  linked: SessionUserJson | null
): Promise<Response> {
  if (linked === null) return c.json({ error: 'account_conflict' }, 409);
  return finishOauthCallback({ c, deps, oauthState, user: linked });
}

export async function handleGoogleCallback(
  c: Context,
  deps: CreateAuthAppDeps,
  code: string,
  oauthState: OauthStateRow
): Promise<Response> {
  const google = deps.providers.google;
  if (google === undefined) return c.json({ error: 'provider_disabled' }, 404);
  let googleUser: Awaited<ReturnType<typeof exchangeGoogleAuthorizationCode>>;
  try {
    googleUser = await exchangeGoogleAuthorizationCode({
      http: deps.http,
      google,
      redirectUri: `${deps.baseURL.replace(/\/$/, '')}${publicPrefix(deps)}/auth/callback/google`,
      code,
      codeVerifier: oauthState.code_verifier,
    });
  } catch {
    return c.json({ error: 'google_exchange_failed' }, 400);
  }
  if (!googleUser.emailVerified) {
    return c.json({ error: 'email_unverified' }, 400);
  }
  const linked = await resolveProviderUser(repo(deps), {
    provider: IDP_PROVIDER_GOOGLE,
    providerUserId: googleUser.sub,
    email: googleUser.email,
    name: googleUser.name,
    image: googleUser.picture,
    accessToken: googleUser.accessToken,
    refreshToken: googleUser.refreshToken,
    linkUserId: oauthState.user_id,
  });
  return finishLinkedUser(c, deps, oauthState, linked);
}

export async function handleAppleCallback(
  c: Context,
  deps: CreateAuthAppDeps,
  idToken: string,
  oauthState: OauthStateRow
): Promise<Response> {
  const apple = deps.providers.apple;
  if (apple === undefined) return c.json({ error: 'provider_disabled' }, 404);
  let appleUser: Awaited<ReturnType<typeof verifyAppleIdToken>>;
  try {
    appleUser = await verifyAppleIdToken({
      http: deps.http,
      apple,
      idToken,
      nonce: oauthState.code_verifier,
      nowMs: deps.clock.now(),
    });
  } catch {
    return c.json({ error: 'apple_token_invalid' }, 400);
  }
  const linked = await resolveProviderUser(repo(deps), {
    provider: IDP_PROVIDER_APPLE,
    providerUserId: appleUser.sub,
    email: appleUser.email,
    name: null,
    image: null,
    linkUserId: oauthState.user_id,
  });
  return finishLinkedUser(c, deps, oauthState, linked);
}
