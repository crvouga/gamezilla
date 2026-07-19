import { describe, expect, it } from 'bun:test';

import { SecretMissingError, SecretStoreRequestError } from './errors';
import { createEnvSecretStore } from './impl-env';
import {
  RecordSecretStore,
  createRecordSecretStore,
} from './record-secret-store';

describe('RecordSecretStore', () => {
  it('returns trimmed redacted secrets', async () => {
    const store = new RecordSecretStore({ TOKEN: '  secret-value  ' });

    const secret = await store.getRequired('TOKEN');

    expect(secret.name).toBe('TOKEN');
    expect(secret.readSecretValue()).toBe('secret-value');
    expect(String(secret)).toBe('SecretString(TOKEN)');
  });

  it('treats missing and blank values as optional misses', async () => {
    const store = createRecordSecretStore({ BLANK: '   ' });

    await expect(store.getOptional('MISSING')).resolves.toBeNull();
    await expect(store.getOptional('BLANK')).resolves.toBeNull();
  });

  it('throws a typed error for required misses', async () => {
    const store = createRecordSecretStore({});

    await expect(store.getRequired('MISSING')).rejects.toBeInstanceOf(
      SecretMissingError
    );
  });

  it('returns one entry per requested key in batch reads', async () => {
    const store = createRecordSecretStore({ A: 'alpha', B: ' ' });

    const optional = await store.getOptionalMany(['A', 'B', 'C']);
    expect(optional['A']?.readSecretValue()).toBe('alpha');
    expect(optional['B']).toBeNull();
    expect(optional['C']).toBeNull();

    await expect(store.getRequiredMany(['A', 'C'])).rejects.toBeInstanceOf(
      SecretMissingError
    );
  });

  it('rejects writes because the store is read-only', async () => {
    const store = createRecordSecretStore({});

    await expect(store.setSecret('TOKEN', 'value')).rejects.toBeInstanceOf(
      SecretStoreRequestError
    );
  });
});

describe('createEnvSecretStore', () => {
  it('copies string bindings and ignores undefined values', async () => {
    const store = createEnvSecretStore({
      TOKEN: 'value',
      MISSING: undefined,
    });

    expect((await store.getRequired('TOKEN')).readSecretValue()).toBe('value');
    await expect(store.getOptional('MISSING')).resolves.toBeNull();
  });
});
