import { createPublicKey, generateKeyPairSync } from 'node:crypto';

export const POWERSYNC_JWT_KID = 'powersync' as const;

export type PowerSyncJwtKeypair = {
  readonly privateKeyPem: string;
  readonly publicJwkJson: string;
};

/** Generates an RS256 keypair for PowerSync client auth (kid `powersync`). */
export function generatePowerSyncJwtKeypair(): PowerSyncJwtKeypair {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  const jwk = createPublicKey(publicKey).export({ format: 'jwk' });
  const publicJwk = {
    kty: jwk.kty,
    n: jwk.n,
    e: jwk.e,
    alg: 'RS256',
    kid: POWERSYNC_JWT_KID,
    use: 'sig',
  };
  return {
    privateKeyPem: privateKey.trim(),
    publicJwkJson: JSON.stringify(publicJwk),
  };
}
