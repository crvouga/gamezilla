import { resolveSecretsScope } from '@pkgs/secrets-config';
import { join } from 'node:path';
import { STRIPE_CLI_LOG_TAG } from './constants';

const REPO_ROOT = join(import.meta.dirname, '../../..');

export function resolveSecretsEnvName(): string {
  const fromEnv = process.env['SECRETS_ENV']?.trim();
  if (fromEnv !== undefined && fromEnv.length > 0) return fromEnv;
  return resolveSecretsScope(REPO_ROOT).env;
}

/** Exit unless secrets env is `dev` (never write webhook secrets to prd). */
export function exitUnlessDevSecretsEnv(config: string): void {
  if (config === 'dev') return;
  console.error(
    `[${STRIPE_CLI_LOG_TAG}] Refusing to write STRIPE_WEBHOOK_SECRET: secrets env must be \`dev\` (got ${config.length > 0 ? JSON.stringify(config) : 'empty'}). ` +
      'Set SECRETS_ENV=dev or use `bun run scripts/secrets-run.ts`.'
  );
  process.exit(1);
}
