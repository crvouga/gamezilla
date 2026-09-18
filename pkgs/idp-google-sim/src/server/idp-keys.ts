// @io-wall-ok — key material adapter; the IdP app itself takes these as a port.

/**
 * RS256 signing key + JWKS, matching the shape Google publishes at
 * `/oauth2/v3/certs`. Relying parties that verify `id_token` signatures
 * against the discovery document work unchanged against this IdP.
 */

import { sha256 } from '@noble/hashes/sha2.js';
import { utf8ToBytes } from '@noble/hashes/utils.js';
import {
  exportJWK,
  generateKeyPair,
  importJWK,
  type JWK,
  type KeyObject,
  SignJWT,
} from 'jose';

export type IdpSigningKeys = {
  readonly kid: string;
  readonly alg: 'RS256';
  readonly privateKey: KeyObject | CryptoKey;
  /** Public half, as served on the certs endpoint. */
  readonly publicJwk: JWK;
};

export async function createIdpSigningKeys(
  kid = 'idp-google-sim-1'
): Promise<IdpSigningKeys> {
  const { privateKey, publicKey } = await generateKeyPair('RS256', {
    extractable: true,
  });
  const publicJwk = await exportJWK(publicKey);
  return {
    kid,
    alg: 'RS256',
    privateKey,
    publicJwk: { ...publicJwk, kid, alg: 'RS256', use: 'sig' },
  };
}

/**
 * The durable form of a signing key. `jose` key objects are not JSON, so the
 * pair is stored as JWKs; a restart imports them back and keeps the same
 * `kid`, which is what makes previously issued `id_token`s keep verifying.
 */
export type IdpSigningKeyRecord = {
  readonly kid: string;
  readonly alg: 'RS256';
  readonly privateJwk: JWK;
  readonly publicJwk: JWK;
};

export async function exportIdpSigningKeyRecord(
  keys: IdpSigningKeys
): Promise<IdpSigningKeyRecord> {
  return {
    kid: keys.kid,
    alg: keys.alg,
    privateJwk: await exportJWK(keys.privateKey),
    publicJwk: keys.publicJwk,
  };
}

export async function importIdpSigningKeyRecord(
  record: IdpSigningKeyRecord
): Promise<IdpSigningKeys> {
  const privateKey = await importJWK(record.privateJwk, record.alg);
  return {
    kid: record.kid,
    alg: record.alg,
    privateKey: privateKey as IdpSigningKeys['privateKey'],
    publicJwk: record.publicJwk,
  };
}

export type IdTokenClaims = {
  readonly iss: string;
  readonly aud: string;
  readonly sub: string;
  readonly email: string;
  readonly email_verified: boolean;
  readonly name: string;
  readonly given_name: string;
  readonly family_name: string;
  readonly picture: string;
  readonly hd?: string;
  readonly nonce?: string;
  readonly at_hash: string;
};

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const b64 =
    typeof btoa === 'function'
      ? btoa(binary)
      : Buffer.from(bytes).toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

/** OIDC `at_hash`: base64url of the left half of SHA-256(access_token). */
export function accessTokenHash(accessToken: string): string {
  const digest = sha256(utf8ToBytes(accessToken));
  return base64Url(digest.slice(0, digest.length / 2));
}

export async function signIdToken(args: {
  readonly keys: IdpSigningKeys;
  readonly claims: IdTokenClaims;
  readonly issuedAtMs: number;
  readonly expiresAtMs: number;
}): Promise<string> {
  const { keys, claims } = args;
  return await new SignJWT({ ...claims, azp: claims.aud })
    .setProtectedHeader({ alg: keys.alg, kid: keys.kid, typ: 'JWT' })
    .setIssuedAt(Math.floor(args.issuedAtMs / 1000))
    .setExpirationTime(Math.floor(args.expiresAtMs / 1000))
    .sign(keys.privateKey);
}
