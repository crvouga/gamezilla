/**
 * Apple's client authentication: the `client_secret` is not a shared secret
 * but an ES256 JWT the relying party signs with its Sign in with Apple key.
 * Apple checks the header `kid`, `iss` (team id), `sub` (client id), `aud`
 * (`https://appleid.apple.com`, literally), and an expiry no more than six
 * months after issue. Any miss is a bare `invalid_client`.
 */

import { importJWK, type JWK, jwtVerify } from 'jose';

import { APPLE_CLIENT_SECRET_AUDIENCE } from '../../shared/paths';
import type { IdpClient } from '../../shared/types';

/** Apple's documented ceiling: 15777000 seconds (six months). */
export const APPLE_CLIENT_SECRET_MAX_LIFETIME_S = 15_777_000;

export async function verifyAppleClientSecret(args: {
  readonly client: IdpClient;
  readonly secret: string;
  readonly nowMs: number;
}): Promise<string | null> {
  const apple = args.client.apple;
  if (apple === undefined) return 'client is not a Services ID';
  try {
    const key = await importJWK(apple.publicJwk as JWK, 'ES256');
    const { payload, protectedHeader } = await jwtVerify(args.secret, key, {
      algorithms: ['ES256'],
      issuer: apple.teamId,
      subject: args.client.clientId,
      audience: APPLE_CLIENT_SECRET_AUDIENCE,
      currentDate: new Date(args.nowMs),
    });
    if (protectedHeader.kid !== apple.keyId) return 'unknown key id';
    const iat = payload.iat ?? 0;
    const exp = payload.exp ?? 0;
    if (exp - iat > APPLE_CLIENT_SECRET_MAX_LIFETIME_S) {
      return 'client secret lifetime exceeds six months';
    }
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : 'invalid client secret';
  }
}
