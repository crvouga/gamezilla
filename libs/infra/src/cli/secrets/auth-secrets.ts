import { randomBytes } from 'node:crypto';
import { requireNonEmpty, Secret, type SecretInput } from './secret';

const MIN_BETTER_AUTH_SECRET_LENGTH = 32;

async function validateBetterAuthSecret(input: SecretInput): Promise<void> {
  const v = input.secretValue.trim();
  requireNonEmpty(v, 'BETTER_AUTH_SECRET');
  if (v.length < MIN_BETTER_AUTH_SECRET_LENGTH) {
    throw new Error(
      `BETTER_AUTH_SECRET must be at least ${String(MIN_BETTER_AUTH_SECRET_LENGTH)} characters`
    );
  }
}

async function validateGoogleClientId(input: SecretInput): Promise<void> {
  requireNonEmpty(input.secretValue, 'WEB_CLIENT_GOOGLE_CLIENT_ID');
}

async function validateGoogleClientSecret(input: SecretInput): Promise<void> {
  requireNonEmpty(input.secretValue, 'WEB_CLIENT_GOOGLE_CLIENT_SECRET');
}

export const BETTER_AUTH_SECRET = new Secret({
  name: 'BETTER_AUTH_SECRET',
  hint: 'Better Auth signing secret (≥32 chars)',
  pushToApiWorker: true,
  seedInAllEnvs: true,
  validate: validateBetterAuthSecret,
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
