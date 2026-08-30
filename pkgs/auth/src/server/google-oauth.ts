import type { HttpClient } from '@pkgs/http-client';

import {
  GOOGLE_OAUTH_AUTHORIZE_URL,
  GOOGLE_OAUTH_TOKEN_URL,
  GOOGLE_OAUTH_USERINFO_URL,
} from '../shared/auth-constants';
import { pkceS256Challenge } from '../shared/pkce';

export type GoogleProviderConfig = {
  readonly clientId: string;
  readonly clientSecret: string;
};

export type GoogleUserInfo = {
  readonly sub: string;
  readonly email: string | null;
  readonly name: string | null;
  readonly picture: string | null;
  readonly accessToken: string | null;
  readonly refreshToken: string | null;
};

export function buildGoogleAuthorizationUrl(args: {
  readonly clientId: string;
  readonly redirectUri: string;
  readonly state: string;
  readonly codeVerifier: string;
}): string {
  const url = new URL(GOOGLE_OAUTH_AUTHORIZE_URL);
  url.searchParams.set('client_id', args.clientId);
  url.searchParams.set('redirect_uri', args.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('state', args.state);
  url.searchParams.set('code_challenge', pkceS256Challenge(args.codeVerifier));
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('prompt', 'select_account');
  return url.toString();
}

export async function exchangeGoogleAuthorizationCode(args: {
  readonly http: HttpClient;
  readonly google: GoogleProviderConfig;
  readonly redirectUri: string;
  readonly code: string;
  readonly codeVerifier: string;
}): Promise<GoogleUserInfo> {
  const body = new URLSearchParams({
    client_id: args.google.clientId,
    client_secret: args.google.clientSecret,
    code: args.code,
    code_verifier: args.codeVerifier,
    grant_type: 'authorization_code',
    redirect_uri: args.redirectUri,
  });
  const tokenRes = await args.http.fetch(GOOGLE_OAUTH_TOKEN_URL, {
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
  const accessToken =
    typeof (tokenJson as { access_token?: unknown }).access_token === 'string'
      ? (tokenJson as { access_token: string }).access_token
      : null;
  const refreshToken =
    typeof (tokenJson as { refresh_token?: unknown }).refresh_token === 'string'
      ? (tokenJson as { refresh_token: string }).refresh_token
      : null;
  if (accessToken === null) {
    throw new Error('google token response missing access_token');
  }

  const userRes = await args.http.fetch(GOOGLE_OAUTH_USERINFO_URL, {
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
  const sub = (profile as { sub?: unknown }).sub;
  if (typeof sub !== 'string' || sub.length === 0) {
    throw new Error('google userinfo missing sub');
  }
  return {
    sub,
    email:
      typeof (profile as { email?: unknown }).email === 'string'
        ? (profile as { email: string }).email
        : null,
    name:
      typeof (profile as { name?: unknown }).name === 'string'
        ? (profile as { name: string }).name
        : null,
    picture:
      typeof (profile as { picture?: unknown }).picture === 'string'
        ? (profile as { picture: string }).picture
        : null,
    accessToken,
    refreshToken,
  };
}
