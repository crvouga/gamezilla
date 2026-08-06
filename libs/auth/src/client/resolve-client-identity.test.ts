import { describe, expect, test } from 'bun:test';

import {
  resolveIsSignedIn,
  resolveMyId,
  shouldBindAnonUserAfterEnsure,
  shouldClearAccountOnExternalUserChange,
} from './resolve-client-identity';

describe('resolveIsSignedIn', () => {
  test('requires user id, token, and non-anon', () => {
    expect(resolveIsSignedIn(null, null, false)).toBe(false);
    expect(resolveIsSignedIn('user', null, false)).toBe(false);
    expect(resolveIsSignedIn(null, 'tok', false)).toBe(false);
    expect(resolveIsSignedIn('user', 'tok', true)).toBe(false);
    expect(resolveIsSignedIn('user', 'tok', false)).toBe(true);
  });
});

describe('resolveMyId', () => {
  test('returns bound user id', () => {
    expect(resolveMyId('user')).toBe('user');
  });

  test('returns empty when no user id bound', () => {
    expect(resolveMyId(null)).toBe('');
  });
});

describe('shouldClearAccountOnExternalUserChange', () => {
  test('clears when signed-in external user id changes', () => {
    expect(
      shouldClearAccountOnExternalUserChange('user_a', 'user_b', true)
    ).toBe(true);
  });

  test('does not clear on first observation or same user', () => {
    expect(shouldClearAccountOnExternalUserChange(null, 'user_a', true)).toBe(
      false
    );
    expect(
      shouldClearAccountOnExternalUserChange('user_a', 'user_a', true)
    ).toBe(false);
  });

  test('does not clear when signed out or next id missing', () => {
    expect(
      shouldClearAccountOnExternalUserChange('user_a', 'user_b', false)
    ).toBe(false);
    expect(shouldClearAccountOnExternalUserChange('user_a', null, true)).toBe(
      false
    );
  });
});

describe('shouldBindAnonUserAfterEnsure', () => {
  test('binds when still signed out', () => {
    expect(shouldBindAnonUserAfterEnsure(null)).toBe(true);
  });

  test('discards when a session token landed during ensure', () => {
    expect(shouldBindAnonUserAfterEnsure('tok')).toBe(false);
  });
});
