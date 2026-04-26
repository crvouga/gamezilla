import { describe, expect, it } from 'bun:test';
import { deriveGoogleProviderState } from './auth-capabilities';
import { GOOGLE_SIGN_IN_UNAVAILABLE_REASON } from './auth-errors';

describe('deriveGoogleProviderState', () => {
  it('marks Google unavailable when client id is missing or blank', () => {
    expect(deriveGoogleProviderState(null)).toEqual({
      available: false,
      unavailableReason: GOOGLE_SIGN_IN_UNAVAILABLE_REASON,
    });
    expect(deriveGoogleProviderState(undefined)).toEqual({
      available: false,
      unavailableReason: GOOGLE_SIGN_IN_UNAVAILABLE_REASON,
    });
    expect(deriveGoogleProviderState('')).toEqual({
      available: false,
      unavailableReason: GOOGLE_SIGN_IN_UNAVAILABLE_REASON,
    });
    expect(deriveGoogleProviderState('   ')).toEqual({
      available: false,
      unavailableReason: GOOGLE_SIGN_IN_UNAVAILABLE_REASON,
    });
  });

  it('marks Google available when a non-empty client id is present', () => {
    expect(
      deriveGoogleProviderState('abc.apps.googleusercontent.com')
    ).toEqual({
      available: true,
      unavailableReason: null,
    });
  });
});
