import { describe, expect, it } from 'bun:test';
import { HOSTED_SIGN_IN_UNAVAILABLE_REASON } from './auth-errors';
import { deriveHostedAuthUiFromApiUrl } from './hosted-auth-ui';

describe('deriveHostedAuthUiFromApiUrl', () => {
  it('marks hosted sign-in unavailable when API URL is missing or blank', () => {
    expect(deriveHostedAuthUiFromApiUrl(null)).toEqual({
      available: false,
      unavailableReason: HOSTED_SIGN_IN_UNAVAILABLE_REASON,
    });
    expect(deriveHostedAuthUiFromApiUrl(undefined)).toEqual({
      available: false,
      unavailableReason: HOSTED_SIGN_IN_UNAVAILABLE_REASON,
    });
    expect(deriveHostedAuthUiFromApiUrl('')).toEqual({
      available: false,
      unavailableReason: HOSTED_SIGN_IN_UNAVAILABLE_REASON,
    });
    expect(deriveHostedAuthUiFromApiUrl('   ')).toEqual({
      available: false,
      unavailableReason: HOSTED_SIGN_IN_UNAVAILABLE_REASON,
    });
  });

  it('marks hosted sign-in available when a non-empty API URL is present', () => {
    expect(deriveHostedAuthUiFromApiUrl('https://api.example.com')).toEqual({
      available: true,
      unavailableReason: null,
    });
  });
});
