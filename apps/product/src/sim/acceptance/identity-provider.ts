import {
  GOOGLE_OAUTH_TOKEN_URL,
  GOOGLE_OAUTH_USERINFO_URL,
} from '@pkgs/auth/shared/auth-constants';
import type { HttpClient } from '@pkgs/http-client';

/** Only the external provider is simulated. Auth routes, sessions and SQL are real. */
export type IdentityProvider = HttpClient & {
  identity: { sub: string; email: string | null; verified: boolean };
  fault:
    | 'none'
    | 'offline'
    | 'token-503'
    | 'userinfo-503'
    | 'malformed-token'
    | 'malformed-profile';
  appleToken: string;
  appleKeys: unknown[];
};

function googleResponse(
  provider: IdentityProvider,
  url: string
): Response | null {
  if (url === GOOGLE_OAUTH_TOKEN_URL) {
    if (provider.fault === 'token-503')
      return new Response('', { status: 503 });
    if (provider.fault === 'malformed-token') return Response.json({});
    return Response.json({ access_token: 'fixture-token' });
  }
  if (url !== GOOGLE_OAUTH_USERINFO_URL) return null;
  if (provider.fault === 'userinfo-503')
    return new Response('', { status: 503 });
  if (provider.fault === 'malformed-profile') return Response.json({});
  return Response.json({
    sub: provider.identity.sub,
    email: provider.identity.email,
    email_verified: provider.identity.verified,
    name: provider.identity.sub,
  });
}

function appleResponse(
  provider: IdentityProvider,
  url: string
): Response | null {
  if (url === 'https://appleid.apple.com/auth/keys') {
    return Response.json({ keys: provider.appleKeys });
  }
  if (url !== 'https://appleid.apple.com/auth/token') return null;
  return Response.json({
    id_token: provider.appleToken,
    access_token: 'apple-fixture',
    token_type: 'Bearer',
  });
}

export function createIdentityProvider(): IdentityProvider {
  const provider: IdentityProvider = {
    identity: {
      sub: 'alice-google',
      email: 'alice@example.test',
      verified: true,
    },
    fault: 'none',
    appleToken: '',
    appleKeys: [],
    async fetch(input) {
      const url = String(input);
      if (provider.fault === 'offline') throw new Error('provider unavailable');
      const apple = appleResponse(provider, url);
      if (apple !== null) return apple;
      const google = googleResponse(provider, url);
      if (google !== null) return google;
      throw new Error(`Unexpected vendor request: ${url}`);
    },
  };
  return provider;
}
