/**
 * Canonical Vault store coordinates for this repo. Keep
 * [`.vault.yaml`](../../../.vault.yaml) in sync — run
 * `bun run --filter @pkgs/vault write-vault-yaml` after changing these.
 */
export const VAULT_DEFAULTS = {
  addr: 'https://secret-store.chrisvouga.dev',
  mount: 'secret',
  project: 'personal',
  config: 'dev',
} as const;

export type VaultDefaults = typeof VAULT_DEFAULTS;
