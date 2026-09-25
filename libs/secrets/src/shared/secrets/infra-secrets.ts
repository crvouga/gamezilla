import { requireNonEmpty, Secret, type SecretInput } from './secret';

/**
 * Credentials OpenTofu itself needs (`libs/infra/scripts/tofu.ts`). The state
 * bucket's access key is written by the bootstrap stack that creates the
 * bucket; the passphrase (which encrypts that stack's own state) and the Neon
 * key (Neon projects are never created by code) are entered by a person.
 */

async function validateMinLength(
  input: SecretInput,
  name: string,
  min: number
): Promise<void> {
  requireNonEmpty(input.secretValue, name);
  if (input.secretValue.trim().length < min) {
    throw new Error(`${name} must be at least ${String(min)} characters`);
  }
}

export const TOFU_STATE_PASSPHRASE = new Secret({
  name: 'TOFU_STATE_PASSPHRASE',
  hint: [
    'Passphrase OpenTofu derives the state/plan encryption key from (pbkdf2 → AES-GCM).',
    'Generate once: openssl rand -base64 48. Losing it makes the state unreadable;',
    'rotating it needs an OpenTofu `fallback` key block. Never pushed to a Worker.',
  ].join('\n'),
  validate: (input) => validateMinLength(input, 'TOFU_STATE_PASSPHRASE', 32),
});

export const TOFU_STATE_ACCESS_KEY_ID = new Secret({
  name: 'TOFU_STATE_ACCESS_KEY_ID',
  hint: [
    'R2 S3 access key id for the OpenTofu state bucket (global.tfvars.json `state.bucket`).',
    'Written by `bun run infra:bootstrap` (libs/infra/tofu/modules/state).',
  ].join('\n'),
  managedBy: 'tofu',
  validate: (input) => validateMinLength(input, 'TOFU_STATE_ACCESS_KEY_ID', 16),
});

export const TOFU_STATE_SECRET_ACCESS_KEY = new Secret({
  name: 'TOFU_STATE_SECRET_ACCESS_KEY',
  hint: 'R2 S3 secret access key paired with TOFU_STATE_ACCESS_KEY_ID (written by `bun run infra:bootstrap`).',
  managedBy: 'tofu',
  validate: (input) =>
    validateMinLength(input, 'TOFU_STATE_SECRET_ACCESS_KEY', 32),
});

export const NEON_API_KEY = new Secret({
  name: 'NEON_API_KEY',
  hint: [
    'Neon → Account settings → API keys. Read access is enough: OpenTofu only',
    "asserts the environment's Neon project exists and DATABASE_URL points at it.",
  ].join('\n'),
  validate: (input) => validateMinLength(input, 'NEON_API_KEY', 16),
});
