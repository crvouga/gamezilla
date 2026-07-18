import { describe, expect, test } from 'bun:test';

import { mapSignInStrategyToClerk } from './clerk-sign-in-strategy';

describe('clerk multi-account adapter helpers', () => {
  test('mapSignInStrategyToClerk still maps oauth-google', () => {
    expect(mapSignInStrategyToClerk('oauth-google')).toBe('oauth_google');
  });
});
