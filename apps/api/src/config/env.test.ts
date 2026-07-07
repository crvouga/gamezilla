import { describe, expect, it } from 'bun:test';
import {
  assertSecretsEnvBinding,
  ConfigurationError,
  type ApiWorkerEnv,
} from './env';

const mockEnv = (secretsEnv: string): ApiWorkerEnv => ({
  SECRETS_ENV: secretsEnv,
});

describe('assertSecretsEnvBinding', () => {
  it('throws ConfigurationError when SECRETS_ENV is unset or blank', () => {
    expect(() => assertSecretsEnvBinding(mockEnv(''))).toThrow(
      ConfigurationError
    );
    expect(() => assertSecretsEnvBinding(mockEnv('   '))).toThrow(
      ConfigurationError
    );
    expect(() =>
      assertSecretsEnvBinding(mockEnv(1 as unknown as string))
    ).toThrow(ConfigurationError);
  });

  it('returns trimmed secrets env when valid', () => {
    expect(assertSecretsEnvBinding(mockEnv('  dev  '))).toBe('dev');
  });
});
