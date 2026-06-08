import { VaultCli } from '@pkgs/vault/vault-cli';
import { VaultScriptSecretStore } from './vault-script-secret-store';
import { VaultSecretStore } from './vault-secret-store';
import type { SecretStore } from './interface';

function trimOpt(value: string | undefined): string | null {
  if (value === undefined) return null;
  const t = value.trim();
  return t.length > 0 ? t : null;
}

/**
 * {@link SecretStore} for Node/Bun scripts (setup, migrations, deploy).
 * Reads via Vault KV v2 HTTP and writes via the local Vault CLI.
 */
export function createVaultSecretStoreForScripts(): SecretStore {
  const cli = new VaultCli();
  const { token } = cli.resolveToken();
  const scope = cli.resolveScope();
  const envProject =
    typeof process !== 'undefined'
      ? trimOpt(process.env['VAULT_PROJECT'])
      : null;
  const envConfig =
    typeof process !== 'undefined'
      ? trimOpt(process.env['VAULT_CONFIG'])
      : null;
  const envAddr =
    typeof process !== 'undefined' ? trimOpt(process.env['VAULT_ADDR']) : null;
  const envMount =
    typeof process !== 'undefined' ? trimOpt(process.env['VAULT_MOUNT']) : null;
  const project = envProject ?? scope.project;
  const config = envConfig ?? scope.config;
  const addr = envAddr ?? scope.addr;
  const mount = envMount ?? scope.mount;
  const reader = new VaultSecretStore({
    token,
    addr,
    mount,
    project,
    config,
  });
  return new VaultScriptSecretStore(reader, cli);
}
