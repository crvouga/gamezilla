import { describe, expect, it } from 'bun:test';
import {
  assertDopplerTokenBinding,
  ConfigurationError,
} from './env';

describe('assertDopplerTokenBinding', () => {
  it('throws ConfigurationError when DOPPLER_TOKEN is unset or blank', () => {
    expect(() =>
      assertDopplerTokenBinding({ DOPPLER_TOKEN: '' })
    ).toThrow(ConfigurationError);
    expect(() =>
      assertDopplerTokenBinding({ DOPPLER_TOKEN: '   ' })
    ).toThrow(ConfigurationError);
    expect(() =>
      assertDopplerTokenBinding({
        DOPPLER_TOKEN: 1 as unknown as string,
      })
    ).toThrow(ConfigurationError);
  });

  it('returns trimmed token when valid', () => {
    expect(
      assertDopplerTokenBinding({ DOPPLER_TOKEN: '  dp.st.x  ' })
    ).toBe('dp.st.x');
  });
});
