import { VaultCli } from '@pkgs/vault/vault-cli';
import type { SecretString } from '@pkgs/secret-string/secret-string';
import type { VaultSecretStore } from './vault-secret-store';
import type {
  SecretStore,
  SecretStoreGetInit,
  SecretStoreSetInit,
} from './interface';

/**
 * Script-side {@link SecretStore} that reads via Vault KV v2 HTTP and writes
 * via the local Vault CLI wrapper (`vault kv patch`).
 */
export class VaultScriptSecretStore implements SecretStore {
  private readonly reader: VaultSecretStore;
  private readonly cli: VaultCli;

  constructor(reader: VaultSecretStore, cli: VaultCli = new VaultCli()) {
    this.reader = reader;
    this.cli = cli;
  }

  getRequired(name: string, init?: SecretStoreGetInit): Promise<SecretString> {
    return this.reader.getRequired(name, init);
  }

  getOptional(
    name: string,
    init?: SecretStoreGetInit
  ): Promise<SecretString | null> {
    return this.reader.getOptional(name, init);
  }

  getRequiredMany(
    names: readonly string[],
    init?: SecretStoreGetInit
  ): Promise<Record<string, SecretString>> {
    return this.reader.getRequiredMany(names, init);
  }

  getOptionalMany(
    names: readonly string[],
    init?: SecretStoreGetInit
  ): Promise<Record<string, SecretString | null>> {
    return this.reader.getOptionalMany(names, init);
  }

  async setSecret(
    name: string,
    value: string,
    _init?: SecretStoreSetInit
  ): Promise<void> {
    this.cli.setSecret(name, value);
  }
}
