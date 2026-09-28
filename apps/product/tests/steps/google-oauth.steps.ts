// @io-wall-ok — live health: Google OAuth client configuration.
/**
 * `specs/health/sign-in.feature`. Asks Google's authorize endpoint
 * directly (no Worker, no sign-in): a registered redirect_uri is answered
 * with the sign-in page; an unregistered one with Google's error page
 * carrying `redirect_uri_mismatch`.
 */

import { expect } from 'bun:test';
import { authRelayOrigin } from '@libs/infra/public/env-file';
import type { HttpClient } from '@pkgs/http-client';
import { Then } from './define';
import { requireSecret } from './live-world';

type Verdict =
  | 'accepted'
  | 'redirect_uri_mismatch'
  | 'invalid_client'
  | 'unknown';

/** Google's error redirect carries a base64 protobuf naming the reason. */
function verdictOf(location: string): Verdict {
  const url = new URL(location, 'https://accounts.google.com');
  if (!url.pathname.includes('/oauth/error')) return 'accepted';
  const raw = url.searchParams.get('authError') ?? '';
  const reason = Buffer.from(raw, 'base64').toString('latin1');
  if (reason.includes('redirect_uri_mismatch')) return 'redirect_uri_mismatch';
  if (reason.includes('invalid_client')) return 'invalid_client';
  return 'unknown';
}

async function authorize(
  http: HttpClient,
  clientId: string,
  callback: string
): Promise<Verdict> {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callback,
    response_type: 'code',
    scope: 'openid email profile',
    state: 'health',
    code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    code_challenge_method: 'S256',
  });
  const res = await http.fetch(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
    { redirect: 'manual' }
  );
  const location = res.headers.get('location');
  if (res.status !== 302 || location === null) return 'unknown';
  return verdictOf(location);
}

Then(
  'Google agrees to send people back to the app after they sign in',
  async (w) => {
    const callback = `${authRelayOrigin()}/api/auth/callback/google`;
    const verdict = await authorize(
      w.http,
      requireSecret('WEB_CLIENT_GOOGLE_CLIENT_ID'),
      callback
    );
    expect(
      verdict,
      verdict === 'redirect_uri_mismatch'
        ? `Add "${callback}" to the OAuth client's Authorized redirect URIs: https://console.cloud.google.com/apis/credentials`
        : `Google rejected the OAuth client (${verdict})`
    ).toBe('accepted');
  }
);
