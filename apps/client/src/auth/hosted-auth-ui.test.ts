import { describe, expect, it } from 'bun:test';
import { CLERK_SIGN_IN_UNAVAILABLE_REASON } from './auth-errors';
import { deriveHostedAuthUiFromPublishableKey } from './hosted-auth-ui';

describe('deriveHostedAuthUiFromPublishableKey', () => {
  it('marks hosted sign-in unavailable when publishable key is missing or blank', () => {
    expect(deriveHostedAuthUiFromPublishableKey(null)).toEqual({
      available: false,
      unavailableReason: CLERK_SIGN_IN_UNAVAILABLE_REASON,
    });
    expect(deriveHostedAuthUiFromPublishableKey(undefined)).toEqual({
      available: false,
      unavailableReason: CLERK_SIGN_IN_UNAVAILABLE_REASON,
    });
    expect(deriveHostedAuthUiFromPublishableKey('')).toEqual({
      available: false,
      unavailableReason: CLERK_SIGN_IN_UNAVAILABLE_REASON,
    });
    expect(deriveHostedAuthUiFromPublishableKey('   ')).toEqual({
      available: false,
      unavailableReason: CLERK_SIGN_IN_UNAVAILABLE_REASON,
    });
  });

  it('marks hosted sign-in available when a non-empty publishable key is present', () => {
    expect(deriveHostedAuthUiFromPublishableKey('pk_test_123')).toEqual({
      available: true,
      unavailableReason: null,
    });
  });
});
