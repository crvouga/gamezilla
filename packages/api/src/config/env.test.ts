import { describe, expect, it } from 'bun:test';
import type { R2Bucket } from '@gamezilla/object-store/impl-r2';
import {
  assertDopplerTokenBinding,
  ConfigurationError,
  type ApiWorkerEnv,
} from './env';

const stubR2Bucket = {} as R2Bucket;

const mockEnv = (token: string): ApiWorkerEnv => ({
  DOPPLER_TOKEN: token,
  HYPERDRIVE: { connectionString: 'postgres://localhost/postgres' },
  TTS_AUDIO: stubR2Bucket,
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
