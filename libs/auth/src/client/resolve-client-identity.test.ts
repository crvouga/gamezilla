import { describe, expect, test } from 'bun:test';

import {
  resolveIsSignedIn,
  resolveMyId,
  shouldClearAccountOnExternalUserChange,
} from './resolve-client-identity';

describe('resolveIsSignedIn', () => {
  test('requires both account id and token', () => {
    expect(resolveIsSignedIn(null, null)).toBe(false);
    expect(resolveIsSignedIn('acct', null)).toBe(false);
    expect(resolveIsSignedIn(null, 'tok')).toBe(false);
    expect(resolveIsSignedIn('acct', 'tok')).toBe(true);
  });
});

describe('resolveMyId', () => {
  test('prefers bound account id', () => {
    expect(
      resolveMyId({
        accountId: 'acct',
        cachedAccountId: 'cached',
        token: 'tok',
        deviceId: 'device',
      })
    ).toBe('acct');
  });

  test('uses cached account id while token present and storage hook lagging', () => {
    expect(
      resolveMyId({
        accountId: null,
        cachedAccountId: 'cached',
        token: 'tok',
        deviceId: 'device',
      })
    ).toBe('cached');
  });

  test('does not fall back to device id while session token awaits account id', () => {
    expect(
      resolveMyId({
        accountId: null,
        cachedAccountId: null,
        token: 'tok',
        deviceId: 'device',
      })
    ).toBe('');
  });

  test('uses device id when fully signed out', () => {
    expect(
      resolveMyId({
        accountId: null,
        cachedAccountId: null,
        token: null,
        deviceId: 'device',
      })
    ).toBe('device');
  });

  test('returns empty when signed out and device id missing', () => {
    expect(
      resolveMyId({
        accountId: null,
        cachedAccountId: null,
        token: null,
        deviceId: null,
      })
    ).toBe('');
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
