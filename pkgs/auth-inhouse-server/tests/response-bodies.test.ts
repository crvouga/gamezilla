import { expect, test } from 'bun:test';
import { createAppleProvider } from '@pkgs/auth-inhouse-server/apple-oauth';
import {
  createGoogleProvider,
  exchangeGoogleAuthorizationCode,
} from '@pkgs/auth-inhouse-server/google-oauth';
import { createJwksVerifier } from '@pkgs/auth-inhouse-server/jwks-verifier';
import { HttpResponseScope } from '@pkgs/http-client-shared/response-scope';

const google = {
  clientId: 'fixture',
  clientSecret: 'fixture',
  endpoints: {
    authorizeUrl: 'https://provider.example/authorize',
    tokenUrl: 'https://provider.example/token',
    userinfoUrl: 'https://provider.example/userinfo',
    revokeUrl: 'https://provider.example/revoke',
  },
};

// Public test-only P-256 scalar 1, not a provider credential.
const privateJwk = {
  kty: 'EC',
  crv: 'P-256',
  d: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAE',
  x: 'axfR8uEsQkf4vOblY6RA8ncDfYEt6zOg9KE5RdiYwpY',
  y: 'T-NC4v4af5uO5-tKfA-eFivOM1drMV7Oy7ZAaDe_UfU',
};

test.each([200, 503])(
  'provider revocation releases HTTP %i response bodies',
  async (status) => {
    // regression: oauth-response-body-leak
    for (const provider of ['google', 'apple']) {
      let calls = 0;
      const http = new HttpResponseScope({
        fetch: async () => {
          calls++;
          return Response.json({}, { status });
        },
      });
      const adapter =
        provider === 'google'
          ? createGoogleProvider({ google, http })
          : createAppleProvider({
              http,
              clock: { now: () => 1_000_000 },
              apple: {
                clientId: 'fixture',
                teamId: 'fixture',
                keyId: 'fixture',
                privateJwk,
                issuer: 'https://provider.example',
                endpoints: {
                  ...google.endpoints,
                  jwksUrl: 'https://provider.example/jwks',
                },
              },
            });
      expect(await adapter.revoke('fixture-token')).toBe(status === 200);
      expect(calls).toBe(1);
      await http.finish();
    }
  }
);

test('a refused token exchange releases its response before throwing', async () => {
  const http = new HttpResponseScope({
    fetch: async () => Response.json({}, { status: 503 }),
  });
  await expect(
    exchangeGoogleAuthorizationCode({
      http,
      google,
      redirectUri: 'https://client.example/callback',
      code: 'fixture-code',
      codeVerifier: 'fixture-verifier',
    })
  ).rejects.toThrow('google token exchange failed: 503');
  await http.finish();
});

test('a refused key lookup releases its response before throwing', async () => {
  const http = new HttpResponseScope({
    fetch: async () => Response.json({}, { status: 503 }),
  });
  const verify = createJwksVerifier({
    http,
    clock: { now: () => 1_000_000 },
    jwksUrl: 'https://provider.example/jwks',
  });
  await expect(
    verify('fixture-token', { issuer: 'fixture', audience: 'fixture' })
  ).rejects.toThrow('jwks fetch failed: 503');
  await http.finish();
});
