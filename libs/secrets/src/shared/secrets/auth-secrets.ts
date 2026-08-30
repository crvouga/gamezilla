// @io-wall-ok
import { randomBytes } from 'node:crypto';
import { requireNonEmpty, Secret, type SecretInput } from './secret';

const MIN_AUTH_SECRET_LENGTH = 32;

async function validateAuthSecret(input: SecretInput): Promise<void> {
  const v = input.secretValue.trim();
  requireNonEmpty(v, 'AUTH_SECRET');
  if (v.length < MIN_AUTH_SECRET_LENGTH) {
    throw new Error(
      `AUTH_SECRET must be at least ${String(MIN_AUTH_SECRET_LENGTH)} characters`
    );
  }
}

async function validateGoogleClientId(input: SecretInput): Promise<void> {
  requireNonEmpty(input.secretValue, 'WEB_CLIENT_GOOGLE_CLIENT_ID');
}

async function validateGoogleClientSecret(input: SecretInput): Promise<void> {
  requireNonEmpty(input.secretValue, 'WEB_CLIENT_GOOGLE_CLIENT_SECRET');
}

export const AUTH_SECRET = new Secret({
  name: 'AUTH_SECRET',
  hint: 'IdP signing secret (≥32 chars)',
  pushToApiWorker: true,
  seedInAllEnvs: true,
  validate: validateAuthSecret,
  seed: async () => randomBytes(32).toString('base64url'),
});

export const WEB_CLIENT_GOOGLE_CLIENT_ID = new Secret({
  name: 'WEB_CLIENT_GOOGLE_CLIENT_ID',
  hint: 'Google OAuth web client id',
  pushToApiWorker: true,
  validate: validateGoogleClientId,
});

export const WEB_CLIENT_GOOGLE_CLIENT_SECRET = new Secret({
  name: 'WEB_CLIENT_GOOGLE_CLIENT_SECRET',
  hint: 'Google OAuth web client secret',
  pushToApiWorker: true,
  validate: validateGoogleClientSecret,
});
