import { describe, expect, test } from 'bun:test';
import {
  ConfigurationError,
  resolveCheckoutProvider,
} from '@libs/app-shared/env';

describe('resolveCheckoutProvider', () => {
  test('the named provider, when it is configured', () => {
    expect(resolveCheckoutProvider('beta', ['alpha', 'beta'])).toBe('beta');
  });

  test('the only configured provider, when none is named', () => {
    expect(resolveCheckoutProvider(null, ['stripe'])).toBe('stripe');
    expect(resolveCheckoutProvider(null, ['paddle'])).toBe('paddle');
  });

  test('no provider, no billing', () => {
    expect(resolveCheckoutProvider(null, [])).toBeNull();
  });

  test('never a silent pick between several', () => {
    expect(() => resolveCheckoutProvider(null, ['stripe', 'paddle'])).toThrow(
      ConfigurationError
    );
  });

  test('never a provider that is not configured', () => {
    expect(() => resolveCheckoutProvider('paddle', ['stripe'])).toThrow(
      'paddle is not configured'
    );
  });
});
