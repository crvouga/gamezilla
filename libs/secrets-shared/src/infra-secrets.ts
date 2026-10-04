import type { SecretInput } from './secret';
import { requireNonEmpty, Secret } from './secret';

/**
 * Credentials OpenTofu itself needs (`libs/infra-server/scripts/tofu.ts`). The state
 * bucket's access key is written by the bootstrap stack that creates the
 * bucket; the passphrase (which encrypts that stack's own state) is entered
 * by a person. PlanetScale and the AWS account keys are entered by a person
 * too: OpenTofu uses them and never creates the accounts.
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
    'Written by `bun run infra:bootstrap` (libs/infra-shared/tofu/modules/state).',
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

export const PLANETSCALE_SERVICE_TOKEN_ID = new Secret({
  name: 'PLANETSCALE_SERVICE_TOKEN_ID',
  hint: "PlanetScale service token id. OpenTofu creates each environment's Neki database with it. Account-wide, shared.",
  validate: (input) =>
    validateMinLength(input, 'PLANETSCALE_SERVICE_TOKEN_ID', 8),
});

export const PLANETSCALE_SERVICE_TOKEN = new Secret({
  name: 'PLANETSCALE_SERVICE_TOKEN',
  hint: 'PlanetScale service token paired with PLANETSCALE_SERVICE_TOKEN_ID. Account-wide, shared. Never pushed to a Worker.',
  validate: (input) =>
    validateMinLength(input, 'PLANETSCALE_SERVICE_TOKEN', 16),
});

export const GITHUB_ADMIN_TOKEN = new Secret({
  name: 'GITHUB_ADMIN_TOKEN',
  hint: [
    'GitHub token with repository admin rights: the bootstrap stack manages the',
    'repository, branch protection and Actions variables (libs/infra-shared/tofu/modules/repository).',
  ].join('\n'),
  optional: true,
  validate: (input) => validateMinLength(input, 'GITHUB_ADMIN_TOKEN', 20),
});
