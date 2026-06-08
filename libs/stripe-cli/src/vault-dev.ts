import { VaultCli } from '@pkgs/vault/vault-cli';
import { STRIPE_CLI_LOG_TAG } from './constants';

export function resolveVaultConfigName(): string {
  const fromEnv = process.env['VAULT_CONFIG']?.trim();
  if (fromEnv !== undefined && fromEnv.length > 0) return fromEnv;
  return new VaultCli().tryConfigureGetConfigPlain() ?? '';
}

/** Exit unless Vault is scoped to `dev` (never write webhook secrets to prd). */
export function exitUnlessDevVaultConfig(config: string): void {
  if (config === 'dev') return;
  console.error(
    `[${STRIPE_CLI_LOG_TAG}] Refusing to write STRIPE_WEBHOOK_SECRET: Vault config must be \`dev\` (got ${config.length > 0 ? JSON.stringify(config) : 'empty'}). ` +
      'Set VAULT_CONFIG=dev, run `vault setup --project personal --config dev` from the repo root, or use `bun run scripts/vault-run.ts`.'
  );
  process.exit(1);
}
