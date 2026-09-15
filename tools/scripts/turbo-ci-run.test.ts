import { describe, expect, test } from 'bun:test';

import { DEFAULT_TURBO_API } from '../../libs/secrets/src/shared/secrets/turbo-token';
import {
  flattenCheckAggregators,
  hasRemoteCreds,
  resolveCacheFlag,
  turboChildEnv,
} from './turbo-ci-run';

describe('turbo-ci-run cache flags', () => {
  test('hasRemoteCreds requires both token and team', () => {
    expect(hasRemoteCreds({})).toBe(false);
    expect(hasRemoteCreds({ TURBO_TOKEN: 'tok' })).toBe(false);
    expect(hasRemoteCreds({ TURBO_TEAM: 'local' })).toBe(false);
    expect(hasRemoteCreds({ TURBO_TOKEN: '  ', TURBO_TEAM: 'local' })).toBe(
      false
    );
    expect(hasRemoteCreds({ TURBO_TOKEN: 'tok', TURBO_TEAM: 'local' })).toBe(
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

describe('turbo-ci-run TURBO_API', () => {
  test('defaults TURBO_API when remote creds present and API unset', () => {
    const env = turboChildEnv({
      TURBO_TOKEN: 'tok',
      TURBO_TEAM: 'local',
    });
    expect(env['TURBO_API']).toBe(DEFAULT_TURBO_API);
  });

  test('passes through and strips trailing slash on TURBO_API', () => {
    const env = turboChildEnv({
      TURBO_TOKEN: 'tok',
      TURBO_TEAM: 'local',
      TURBO_API: 'https://turborepo.chrisvouga.dev/',
    });
    expect(env['TURBO_API']).toBe(DEFAULT_TURBO_API);
  });

  test('does not invent TURBO_API without remote creds', () => {
    const env = turboChildEnv({});
    expect(env['TURBO_API']).toBeUndefined();
  });
});

describe('turbo-ci-run aggregator flatten', () => {
  const tasks = {
    '//#check': { dependsOn: ['lint', 'tc', 'test'] },
    '//#check:full': {
      dependsOn: ['//#check', '//#ci:audit', '@libs/secrets#check'],
    },
  };

  test('check expands to fast leaves', () => {
    expect(flattenCheckAggregators(['check'], tasks)).toEqual([
      'lint',
      'tc',
      'test',
    ]);
    expect(flattenCheckAggregators(['//#check'], tasks)).toEqual([
      'lint',
      'tc',
      'test',
    ]);
  });

  test('check:full recursively expands //#check', () => {
    expect(flattenCheckAggregators(['check:full'], tasks)).toEqual([
      'lint',
      'tc',
      'test',
      '//#ci:audit',
      '@libs/secrets#check',
    ]);
  });

  test('non-aggregator args pass through', () => {
    expect(flattenCheckAggregators(['lint', 'tc'], tasks)).toEqual([
      'lint',
      'tc',
    ]);
  });

  test('deploy expands to //#deploy leaves', () => {
    const withDeploy = {
      ...tasks,
      '//#deploy': {
        dependsOn: ['tc', '@apps/server#smoke'],
      },
    };
    expect(flattenCheckAggregators(['deploy'], withDeploy)).toEqual([
      'tc',
      '@apps/server#smoke',
    ]);
    expect(flattenCheckAggregators(['//#deploy'], withDeploy)).toEqual([
      'tc',
      '@apps/server#smoke',
    ]);
  });
});
