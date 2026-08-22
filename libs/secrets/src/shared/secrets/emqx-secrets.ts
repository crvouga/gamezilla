import { PRODUCT_CONFIG } from '@libs/db/public/product-config';
import {
  requireHttpsUrl,
  requireNonEmpty,
  Secret,
  type SecretInput,
  type SecretSeedInput,
} from './secret';

function emqxHostname(): string {
  return PRODUCT_CONFIG.emqx.hostname;
}

async function validateEmqxApiUrl(input: SecretInput): Promise<void> {
  const v = input.secretValue.trim();
  if (v.length === 0) return;
  requireHttpsUrl(v, 'EMQX_API_URL');
}

async function validateEmqxWssUrl(input: SecretInput): Promise<void> {
  const v = input.secretValue.trim();
  if (v.length === 0) return;
  if (!v.startsWith('wss://') && !v.startsWith('ws://')) {
    throw new Error('EMQX_WSS_URL must start with wss:// or ws://');
  }
}

async function validateNonEmpty(
  name: string,
  input: SecretInput
): Promise<void> {
  if (input.secretValue.trim().length === 0) return;
  requireNonEmpty(input.secretValue, name);
}

async function seedApiUrl(_input: SecretSeedInput): Promise<string> {
  return `https://${emqxHostname()}`;
}

async function seedWssUrl(_input: SecretSeedInput): Promise<string> {
  return `wss://${emqxHostname()}/mqtt`;
}

async function seedApiKey(_input: SecretSeedInput): Promise<string> {
  return 'pubsub-test';
}

async function seedApiSecret(_input: SecretSeedInput): Promise<string> {
  // Must match the EMQX deploy image api-keys.bootstrap.
  return 'pubsub-test-secret';
}

export const EMQX_API_URL = new Secret({
  name: 'EMQX_API_URL',
  hint: `https://${emqxHostname()} — EMQX HTTP API (via Caddy)`,
  optional: true,
  pushToApiWorker: true,
  mirrorToDev: true,
  validate: validateEmqxApiUrl,
  seed: seedApiUrl,
});

export const EMQX_WSS_URL = new Secret({
  name: 'EMQX_WSS_URL',
  hint: `wss://${emqxHostname()}/mqtt`,
  optional: true,
  pushToApiWorker: false,
  mirrorToDev: true,
  validate: validateEmqxWssUrl,
  seed: seedWssUrl,
});

export const EMQX_API_KEY = new Secret({
  name: 'EMQX_API_KEY',
  hint: 'EMQX dashboard API key (Basic auth username)',
  optional: true,
  pushToApiWorker: true,
  mirrorToDev: true,
  validate: (i) => validateNonEmpty('EMQX_API_KEY', i),
  seed: seedApiKey,
});

export const EMQX_API_SECRET = new Secret({
  name: 'EMQX_API_SECRET',
  hint: 'EMQX dashboard API secret (Basic auth password)',
  optional: true,
  pushToApiWorker: true,
  mirrorToDev: true,
  validate: (i) => validateNonEmpty('EMQX_API_SECRET', i),
  seed: seedApiSecret,
});

async function seedJwtSecret(_input: SecretSeedInput): Promise<string> {
  // Local/dev only — operators must rotate for production.
  return 'local-emqx-jwt-secret-change-me';
}

export const EMQX_JWT_SECRET = new Secret({
  name: 'EMQX_JWT_SECRET',
  hint: 'HMAC secret shared with EMQX JWT authenticator (MQTT password = JWT)',
  optional: true,
  pushToApiWorker: true,
  mirrorToDev: true,
  validate: (i) => validateNonEmpty('EMQX_JWT_SECRET', i),
  seed: seedJwtSecret,
});
