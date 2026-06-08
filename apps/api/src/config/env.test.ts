import { describe, expect, it } from 'bun:test';
import {
  assertVaultTokenBinding,
  ConfigurationError,
  type ApiWorkerEnv,
} from './env';

const mockEnv = (token: string): ApiWorkerEnv => ({
  VAULT_TOKEN: token,
});

describe('assertVaultTokenBinding', () => {
  it('throws ConfigurationError when VAULT_TOKEN is unset or blank', () => {
    expect(() => assertVaultTokenBinding(mockEnv(''))).toThrow(
      ConfigurationError
    );
    expect(() => assertVaultTokenBinding(mockEnv('   '))).toThrow(
      ConfigurationError
    );
    expect(() =>
      assertVaultTokenBinding(mockEnv(1 as unknown as string))
    ).toThrow(ConfigurationError);
  });

  it('returns trimmed token when valid', () => {
    expect(assertVaultTokenBinding(mockEnv('  hvs.x  '))).toBe('hvs.x');
  });
});
