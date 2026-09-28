/**
 * The one example app every `@pkgs/idp-mock` test signs people into: a
 * relying party at `https://app.test` registered with a Google-flavored
 * provider (an OAuth client with a secret) and with an Apple-flavored one (a
 * Services ID holding a real ES256 key pair, which mints its own
 * client-secret JWTs and receives Apple's notifications). A test that needs
 * a variation (a forged client secret, another redirect) configures this
 * app; it never registers a client of its own.
 */

import {
  APPLE_CLIENT_SECRET_AUDIENCE,
  type IdpClient,
} from '@pkgs/idp-mock/shared';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';

/** What the providers' screens call the example app. */
export const EXAMPLE_APP_NAME = 'Example App';
export const EXAMPLE_APP_ORIGIN = 'https://app.test';

/** The example app's Google OAuth client. */
export const GOOGLE_CLIENT: IdpClient = {
  clientId: 'example-app.apps.googleusercontent.com',
  clientSecret: 'example-app-client-secret',
  redirectUris: [`${EXAMPLE_APP_ORIGIN}/api/auth/callback/google`],
  appName: EXAMPLE_APP_NAME,
};

export const APPLE_REDIRECT_URI = `${EXAMPLE_APP_ORIGIN}/api/auth/callback/apple`;
export const APPLE_NOTIFICATION_URL = `${EXAMPLE_APP_ORIGIN}/api/auth/apple/events`;
export const APPLE_TEAM_ID = 'TEAM123456';
export const APPLE_KEY_ID = 'KEY1234567';
export const APPLE_CLIENT_ID = 'test.app.signin';

/** The example app as Apple sees it: its Services ID and its own key. */
export type AppleRp = {
  readonly client: IdpClient;
  /** Mint a `client_secret` the way the relying party does. */
  secret(overrides?: {
    readonly iss?: string;
    readonly sub?: string;
    readonly aud?: string;
    readonly kid?: string;
    readonly lifetimeS?: number;
    readonly iatMs?: number;
  }): Promise<string>;
};

export async function createAppleRp(nowMs: () => number): Promise<AppleRp> {
  const { privateKey, publicKey } = await generateKeyPair('ES256', {
    extractable: true,
  });
  const client: IdpClient = {
    clientId: APPLE_CLIENT_ID,
    clientSecret: '',
    redirectUris: [APPLE_REDIRECT_URI],
    appName: EXAMPLE_APP_NAME,
    apple: {
      teamId: APPLE_TEAM_ID,
      keyId: APPLE_KEY_ID,
      publicJwk: { ...(await exportJWK(publicKey)) },
      notificationUrl: APPLE_NOTIFICATION_URL,
    },
  };
  return {
    client,
    async secret(overrides = {}) {
      const iat = Math.floor((overrides.iatMs ?? nowMs()) / 1000);
      return await new SignJWT({})
        .setProtectedHeader({
          alg: 'ES256',
          kid: overrides.kid ?? APPLE_KEY_ID,
        })
        .setIssuer(overrides.iss ?? APPLE_TEAM_ID)
        .setSubject(overrides.sub ?? APPLE_CLIENT_ID)
        .setAudience(overrides.aud ?? APPLE_CLIENT_SECRET_AUDIENCE)
        .setIssuedAt(iat)
        .setExpirationTime(iat + (overrides.lifetimeS ?? 3600))
        .sign(privateKey);
    },
  };
}
