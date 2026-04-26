import { SecretMissingError } from './errors';
import type { SecretStore, SecretStoreGetInit } from './interface';

/**
 * Composes two stores with precedence: `primary` first, then `fallback`.
 */
export class CombinedSecretStore implements SecretStore {
  constructor(
    private readonly primary: SecretStore,
    private readonly fallback: SecretStore
  ) {}

  async getRequired(name: string, init?: SecretStoreGetInit): Promise<string> {
    const value = await this.getOptional(name, init);
    if (value !== null) {
      return value;
    }
    throw new SecretMissingError(name);
  }

  async getOptional(
    name: string,
    init?: SecretStoreGetInit
  ): Promise<string | null> {
    const primaryValue = await this.primary.getOptional(name, init);
    if (primaryValue !== null) {
      return primaryValue;
    }
    return this.fallback.getOptional(name, init);
  }

  async getRequiredMany(
    names: readonly string[],
    init?: SecretStoreGetInit
  ): Promise<Record<string, string>> {
    const out: Record<string, string> = {};
    for (const name of names) {
      out[name] = await this.getRequired(name, init);
    }
    return out;
  }
}

export function createCombinedSecretStore(
  primary: SecretStore,
  fallback: SecretStore
): SecretStore {
  return new CombinedSecretStore(primary, fallback);
}
