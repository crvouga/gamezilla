import type { HttpClient } from '@pkgs/http-client';

import {
  type GoogleOauthEndpoints,
  IDP_PROVIDER_GOOGLE,
} from '../../shared/auth-constants';
import { pkceS256Challenge } from '../../shared/pkce';
import {
  claimFlag,
  claimString,
  type OauthProviderAdapter,
  type ProviderIdentity,
} from './provider-identity';

export type GoogleProviderConfig = {
  readonly clientId: string;
  readonly clientSecret: string;
  /** Production Google, or a simulated provider on loopback. */
  readonly endpoints: GoogleOauthEndpoints;
};

export function buildGoogleAuthorizationUrl(args: {
  readonly google: GoogleProviderConfig;
  readonly redirectUri: string;
  readonly state: string;
  readonly codeVerifier: string;
  readonly nonce?: string;
}): string {
  const url = new URL(args.google.endpoints.authorizeUrl);
  url.searchParams.set('client_id', args.google.clientId);
  url.searchParams.set('redirect_uri', args.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('state', args.state);
  url.searchParams.set('code_challenge', pkceS256Challenge(args.codeVerifier));
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('prompt', 'select_account');
  if (args.nonce !== undefined) url.searchParams.set('nonce', args.nonce);
  return url.toString();
}

async function redeemCode(args: {
  readonly http: HttpClient;
  readonly google: GoogleProviderConfig;
  readonly redirectUri: string;
  readonly code: string;
  readonly codeVerifier: string;
}): Promise<{ accessToken: string; refreshToken: string | null }> {
  const body = new URLSearchParams({
    client_id: args.google.clientId,
    client_secret: args.google.clientSecret,
    code: args.code,
    code_verifier: args.codeVerifier,
    grant_type: 'authorization_code',
    redirect_uri: args.redirectUri,
  });
  const tokenRes = await args.http.fetch(args.google.endpoints.tokenUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!tokenRes.ok) {
    throw new Error(`google token exchange failed: ${String(tokenRes.status)}`);
  }
  const tokenJson: unknown = await tokenRes.json();
  if (tokenJson === null || typeof tokenJson !== 'object') {
    throw new Error('google token response invalid');
  }
  const fields = tokenJson as Record<string, unknown>;
  const accessToken = claimString(fields['access_token']);
  if (accessToken === null) {
    throw new Error('google token response missing access_token');
  }
  return { accessToken, refreshToken: claimString(fields['refresh_token']) };
}

/**
 * Code → tokens → userinfo. The userinfo call is made over TLS straight to
 * Google with the fresh access token, which is what makes its answer
 * trustworthy without verifying the id_token signature (OIDC core 3.1.3.7).
 */
export async function exchangeGoogleAuthorizationCode(args: {
  readonly http: HttpClient;
  readonly google: GoogleProviderConfig;
  readonly redirectUri: string;
  readonly code: string;
  readonly codeVerifier: string;
}): Promise<ProviderIdentity> {
  const { accessToken, refreshToken } = await redeemCode(args);
  const userRes = await args.http.fetch(args.google.endpoints.userinfoUrl, {
    method: 'GET',
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!userRes.ok) {
    throw new Error(`google userinfo failed: ${String(userRes.status)}`);
  }
  const profile: unknown = await userRes.json();
  if (profile === null || typeof profile !== 'object') {
    throw new Error('google userinfo invalid');
  }
  const claims = profile as Record<string, unknown>;
  const sub = claimString(claims['sub']);
  if (sub === null) {
    throw new Error('google userinfo missing sub');
  }
  const email = claimString(claims['email']);
  return {
    provider: IDP_PROVIDER_GOOGLE,
    providerUserId: sub,
    email: email?.toLowerCase() ?? null,
    emailVerified: email !== null && claimFlag(claims['email_verified']),
    isPrivateEmail: false,
    name: claimString(claims['name']),
    picture: claimString(claims['picture']),
    accessToken,
    refreshToken,
  };
}

async function revokeGoogleToken(
  http: HttpClient,
  google: GoogleProviderConfig,
  token: string
): Promise<boolean> {
  try {
    const res = await http.fetch(google.endpoints.revokeUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token }).toString(),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function createGoogleProvider(args: {
  readonly google: GoogleProviderConfig;
  readonly http: HttpClient;
}): OauthProviderAdapter {
  return {
    id: IDP_PROVIDER_GOOGLE,
    callbackMethod: 'GET',
    authorizationUrl: async (auth) =>
      buildGoogleAuthorizationUrl({ google: args.google, ...auth }),
    exchange: async (exchange) =>
      await exchangeGoogleAuthorizationCode({
        http: args.http,
        google: args.google,
        redirectUri: exchange.redirectUri,
        code: exchange.callback.code,
        codeVerifier: exchange.codeVerifier,
      }),
    revoke: async (token) =>
      await revokeGoogleToken(args.http, args.google, token),
  };
}
