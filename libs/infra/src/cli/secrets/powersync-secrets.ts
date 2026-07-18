import { Secret, requireHttpsUrl, requireNonEmpty } from './secret';

export const POWERSYNC_INSTANCE_ID = new Secret({
  name: 'POWERSYNC_INSTANCE_ID',
  hint: 'PowerSync Cloud instance id (written to powersync/cli.yaml via !env)',
  optional: true,
  validate: async (input) => {
    requireNonEmpty(input.secretValue, 'POWERSYNC_INSTANCE_ID');
  },
});

export const POWERSYNC_PROJECT_ID = new Secret({
  name: 'POWERSYNC_PROJECT_ID',
  hint: 'PowerSync Cloud project id (CLI pull/link)',
  optional: true,
  validate: async (input) => {
    requireNonEmpty(input.secretValue, 'POWERSYNC_PROJECT_ID');
  },
});

export const POWERSYNC_URL = new Secret({
  name: 'POWERSYNC_URL',
  hint: 'PowerSync instance URL, e.g. https://<instance-id>.powersync.journeyapps.com',
  optional: true,
  pushToApiWorker: true,
  validate: async (input) => {
    requireHttpsUrl(input.secretValue, 'POWERSYNC_URL');
  },
});

export const PS_ADMIN_TOKEN = new Secret({
  name: 'PS_ADMIN_TOKEN',
  hint: 'PowerSync Cloud personal access token (CLI + deploy auth)',
  optional: true,
  validate: async (input) => {
    requireNonEmpty(input.secretValue, 'PS_ADMIN_TOKEN');
  },
});

function assertJwkObject(value: string, label: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error(`${label} must be valid JSON`);
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${label} must be a JSON object`);
  }
  return parsed as Record<string, unknown>;
}

export const POWERSYNC_JWT_PUBLIC_JWK = new Secret({
  name: 'POWERSYNC_JWT_PUBLIC_JWK',
  hint: 'Inline RS256 public JWK JSON for PowerSync client_auth',
  optional: true,
  validate: async (input) => {
    const v = input.secretValue.trim();
    requireNonEmpty(v, 'POWERSYNC_JWT_PUBLIC_JWK');
    const obj = assertJwkObject(v, 'POWERSYNC_JWT_PUBLIC_JWK');
    const kid = obj['kid'];
    if (typeof kid !== 'string' || kid.length === 0) {
      throw new Error('Must include a non-empty kid');
    }
  },
});

export const POWERSYNC_JWT_PRIVATE_KEY = new Secret({
  name: 'POWERSYNC_JWT_PRIVATE_KEY',
  hint: 'PKCS8 PEM private key used by the API to mint PowerSync JWTs',
  pushToApiWorker: true,
  validate: async (input) => {
    const v = input.secretValue.trim();
    requireNonEmpty(v, 'POWERSYNC_JWT_PRIVATE_KEY');
    if (
      !v.includes('BEGIN PRIVATE KEY') &&
      !v.includes('BEGIN RSA PRIVATE KEY')
    ) {
      throw new Error(
        'POWERSYNC_JWT_PRIVATE_KEY must be a PKCS8 PEM private key'
      );
    }
  },
});

export const EXPO_PUBLIC_POWERSYNC_URL = new Secret({
  name: 'EXPO_PUBLIC_POWERSYNC_URL',
  hint: 'Client-facing PowerSync URL (mirrors POWERSYNC_URL)',
  optional: true,
  validate: async (input) => {
    requireHttpsUrl(input.secretValue, 'EXPO_PUBLIC_POWERSYNC_URL');
  },
  seed: async (input) => {
    const url = input.secrets.get('POWERSYNC_URL')?.trim() ?? '';
    if (url.length === 0) {
      throw new Error('POWERSYNC_URL must be set before seeding EXPO_PUBLIC_POWERSYNC_URL');
    }
    return url;
  },
});
