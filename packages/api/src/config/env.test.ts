import { describe, expect, it } from 'bun:test';
import {
  assertDopplerTokenBinding,
  ConfigurationError,
  type ApiWorkerEnv,
} from './env';

const mockEnv = (token: string): ApiWorkerEnv => ({
  DOPPLER_TOKEN: token,
  HYPERDRIVE: { connectionString: 'postgres://localhost/postgres' },
});

describe('assertDopplerTokenBinding', () => {
  it('throws ConfigurationError when DOPPLER_TOKEN is unset or blank', () => {
    expect(() => assertDopplerTokenBinding(mockEnv(''))).toThrow(
      ConfigurationError
    );
    expect(() => assertDopplerTokenBinding(mockEnv('   '))).toThrow(
      ConfigurationError
    );
    expect(() =>
      assertDopplerTokenBinding(mockEnv(1 as unknown as string))
    ).toThrow(ConfigurationError);
  });

  it('returns trimmed token when valid', () => {
    expect(assertDopplerTokenBinding(mockEnv('  dp.st.x  '))).toBe('dp.st.x');
  });
});
