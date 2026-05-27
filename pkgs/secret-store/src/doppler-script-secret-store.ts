import { DopplerCli } from '@pkgs/doppler/doppler-cli';
import type { SecretString } from '@pkgs/secret-string/secret-string';
import type { DopplerSecretStore } from './doppler-secret-store';
import type {
  SecretStore,
  SecretStoreGetInit,
  SecretStoreSetInit,
} from './interface';

/**
 * Script-side {@link SecretStore} that reads via Doppler's HTTP
 * `secrets/download` endpoint and writes via the local Doppler CLI
 * (`doppler secrets set`).
 *
 * The two transports converge on the same Doppler project/config — the CLI is
 * already configured for the current directory's scope (via `doppler login` or
 * `doppler setup`), so writes land in the same place reads pull from.
 *
 * Workers should NOT use this class — they have no shell. Use the bare
 * {@link DopplerSecretStore} (read-only) with a config-scoped service token.
 *
 * `init.signal` is accepted on writes for API parity but not honored —
 * `child_process.execSync` blocks synchronously and does not surface an
 * abort hook.
 */
export class DopplerScriptSecretStore implements SecretStore {
  private readonly reader: DopplerSecretStore;
  private readonly cli: DopplerCli;

  constructor(reader: DopplerSecretStore, cli: DopplerCli = new DopplerCli()) {
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
