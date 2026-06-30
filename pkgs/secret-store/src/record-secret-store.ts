import type { SecretString } from '@pkgs/secret-string/secret-string';
import { SecretMissingError, SecretStoreRequestError } from './errors';
import type {
  SecretStore,
  SecretStoreGetInit,
  SecretStoreSetInit,
} from './interface';
import { wrapSecretOptional } from './wrap-secret';

/**
 * Read-only {@link SecretStore} backed by an in-memory map (e.g. Worker
 * `.dev.vars` bindings mirrored at setup time).
 */
export class RecordSecretStore implements SecretStore {
  constructor(private readonly values: Readonly<Record<string, string>>) {}

  async getRequired(
    name: string,
    _init?: SecretStoreGetInit
  ): Promise<SecretString> {
    const value = await this.getOptional(name);
    if (value !== null) {
      return value;
    }
    throw new SecretMissingError(name);
  }

  async getOptional(
    name: string,
    _init?: SecretStoreGetInit
  ): Promise<SecretString | null> {
    const raw = this.values[name];
    if (raw === undefined) {
      return null;
    }
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      return null;
    }
    return wrapSecretOptional(name, trimmed);
  }

  async getRequiredMany(
    names: readonly string[],
    init?: SecretStoreGetInit
  ): Promise<Record<string, SecretString>> {
    const out: Record<string, SecretString> = {};
    for (const name of names) {
      out[name] = await this.getRequired(name, init);
    }
    return out;
  }

  async getOptionalMany(
    names: readonly string[],
    init?: SecretStoreGetInit
  ): Promise<Record<string, SecretString | null>> {
    const out: Record<string, SecretString | null> = {};
    for (const name of names) {
      out[name] = await this.getOptional(name, init);
    }
    return out;
  }

  async setSecret(
    name: string,
    _value: string,
    _init?: SecretStoreSetInit
  ): Promise<void> {
    throw new SecretStoreRequestError(
      `RecordSecretStore is read-only; cannot setSecret("${name}")`
    );
  }
}

export function createRecordSecretStore(
  values: Readonly<Record<string, string>>
): SecretStore {
  return new RecordSecretStore(values);
}
