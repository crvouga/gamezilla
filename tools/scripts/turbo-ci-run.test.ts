import { describe, expect, test } from 'bun:test';

import { hasRemoteCreds, resolveCacheFlag } from './turbo-ci-run';

describe('turbo-ci-run cache flags', () => {
  test('hasRemoteCreds requires both token and team', () => {
    expect(hasRemoteCreds({})).toBe(false);
    expect(hasRemoteCreds({ TURBO_TOKEN: 'tok' })).toBe(false);
    expect(hasRemoteCreds({ TURBO_TEAM: 'crvouga' })).toBe(false);
    expect(hasRemoteCreds({ TURBO_TOKEN: '  ', TURBO_TEAM: 'crvouga' })).toBe(
      false
    );
    expect(hasRemoteCreds({ TURBO_TOKEN: 'tok', TURBO_TEAM: 'crvouga' })).toBe(
      true
    );
  });

  test('missing remote creds use local cache only', () => {
    expect(resolveCacheFlag({ TURBO_CACHE: 'local:rw,remote:rw' }, false)).toBe(
      'local:rw'
    );
    expect(resolveCacheFlag({}, false)).toBe('local:rw');
  });

  test('remote creds keep remote cache and honor TURBO_CACHE', () => {
    expect(resolveCacheFlag({}, true)).toBe('local:rw,remote:rw');
    expect(resolveCacheFlag({ TURBO_CACHE: 'local:r' }, true)).toBe(
      'local:r,remote:rw'
    );
    expect(resolveCacheFlag({ TURBO_CACHE: 'remote:rw' }, true)).toBe(
      'local:rw,remote:rw'
    );
  });
});
