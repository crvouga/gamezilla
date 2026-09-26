// @io-wall-ok — live health probe (Google OAuth client configuration).
/**
 * Google accepts the OAuth callback this environment sends. Every
 * environment sends the same one — the relay environment's (see
 * `oauthRelayEnv`) — so a new replica needs no console edit; the relay's
 * registration is the one human-managed setting, and this probe is what
 * notices if it goes missing. It asks Google's authorize endpoint directly
 * (no Worker, no sign-in): a registered redirect_uri is answered with the
 * sign-in page; an unregistered one with Google's error page carrying
 * `redirect_uri_mismatch`.
 */
import { describe, expect, test } from 'bun:test';
import { envOrigins, oauthRelayEnv } from '@libs/infra/public/env-file';
import { ENV_FILES, envFile } from '@libs/infra/public/envs';
import { createGlobalHttpClient } from '@pkgs/http-client';

const http = createGlobalHttpClient();
const env = envFile(process.env['SECRETS_ENV']?.trim() || 'dev');
const relay = oauthRelayEnv(Object.values(ENV_FILES));
const callback = `${envOrigins(relay).api}/api/auth/callback/google`;

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

async function authorize(clientId: string): Promise<Verdict> {
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

describe(`google oauth (${env.env})`, () => {
  test(`Google accepts ${callback} as a redirect URI`, async () => {
    const clientId = process.env['WEB_CLIENT_GOOGLE_CLIENT_ID']?.trim() ?? '';
    expect(clientId, 'WEB_CLIENT_GOOGLE_CLIENT_ID missing').not.toBe('');
    const verdict = await authorize(clientId);
    expect(
      verdict,
      verdict === 'redirect_uri_mismatch'
        ? `Add "${callback}" to the OAuth client's Authorized redirect URIs: https://console.cloud.google.com/apis/credentials`
        : `Google rejected the OAuth client (${verdict})`
    ).toBe('accepted');
  }, 30_000);
});
