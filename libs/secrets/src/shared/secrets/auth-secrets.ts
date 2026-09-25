// @io-wall-ok
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

async function validateSyntheticMonitorToken(
  input: SecretInput
): Promise<void> {
  const v = input.secretValue.trim();
  requireNonEmpty(v, 'SYNTHETIC_MONITOR_TOKEN');
  if (v.length < MIN_AUTH_SECRET_LENGTH) {
    throw new Error(
      `SYNTHETIC_MONITOR_TOKEN must be at least ${String(MIN_AUTH_SECRET_LENGTH)} characters`
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
  managedBy: 'tofu',
  validate: validateAuthSecret,
});

/**
 * Bearer secret the synthetic journeys (`@apps/product#health`) trade for a
 * session as the fixed synthetic-monitor user. The Worker reads it to enable
 * the hidden sign-in route; the health runner reads it to call that route.
 */
export const SYNTHETIC_MONITOR_TOKEN = new Secret({
  name: 'SYNTHETIC_MONITOR_TOKEN',
  hint: 'Synthetic-monitor sign-in bearer (≥32 chars)',
  pushToApiWorker: true,
  managedBy: 'tofu',
  validate: validateSyntheticMonitorToken,
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
