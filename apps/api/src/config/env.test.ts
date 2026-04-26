import { describe, expect, it } from 'bun:test';
import {
  assertDbUrlBinding,
  assertDopplerTokenBinding,
  ConfigurationError,
} from './env';

describe('assertDopplerTokenBinding', () => {
  const db = 'postgresql://u:p@localhost/db';

  it('throws ConfigurationError when DOPPLER_TOKEN is unset or blank', () => {
    expect(() =>
      assertDopplerTokenBinding({ DOPPLER_TOKEN: '', DB_URL: db })
    ).toThrow(ConfigurationError);
    expect(() =>
      assertDopplerTokenBinding({ DOPPLER_TOKEN: '   ', DB_URL: db })
    ).toThrow(ConfigurationError);
    expect(() =>
      assertDopplerTokenBinding({
        DOPPLER_TOKEN: 1 as unknown as string,
        DB_URL: db,
      })
    ).toThrow(ConfigurationError);
  });

  it('returns trimmed token when valid', () => {
    expect(
      assertDopplerTokenBinding({
        DOPPLER_TOKEN: '  dp.st.x  ',
        DB_URL: 'postgresql://u:p@h/db',
      })
    ).toBe('dp.st.x');
  });
});

describe('assertDbUrlBinding', () => {
  it('throws ConfigurationError when DB_URL is unset or blank', () => {
    expect(() =>
      assertDbUrlBinding({
        DB_URL: '',
        DOPPLER_TOKEN: 't',
      })
    ).toThrow(ConfigurationError);
    expect(() =>
      assertDbUrlBinding({
        DB_URL: '   ',
        DOPPLER_TOKEN: 't',
      })
    ).toThrow(ConfigurationError);
  });

  it('returns trimmed DB_URL when valid', () => {
    expect(
      assertDbUrlBinding({
        DB_URL: '  postgresql://u:p@host/db  ',
        DOPPLER_TOKEN: 't',
      })
    ).toBe('postgresql://u:p@host/db');
  });
});
