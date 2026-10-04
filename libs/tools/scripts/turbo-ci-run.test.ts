import { describe, expect, test } from 'bun:test';

import {
  DEFAULT_TURBO_API,
  TURBO_TEAM,
} from '@libs/secrets-shared/turbo-token';
import {
  defaultCheckConcurrency,
  flattenCheckAggregators,
  formatDurations,
  hasRemoteCreds,
  resolveCacheFlag,
  resolveRunMode,
  runModeFlags,
  turboChildEnv,
} from './turbo-ci-run';

describe('turbo-ci-run cache flags', () => {
  test('hasRemoteCreds requires a non-blank token', () => {
    expect(hasRemoteCreds({})).toBe(false);
    expect(hasRemoteCreds({ TURBO_TOKEN: '  ' })).toBe(false);
    expect(hasRemoteCreds({ TURBO_TOKEN: 'tok' })).toBe(true);
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

  // regression: check-cache-write-only-override
  test('accepts Turbo read, write, read/write and disabled modes verbatim', () => {
    for (const local of ['', 'r', 'w', 'rw']) {
      for (const remote of ['', 'r', 'w', 'rw']) {
        const cache = `local:${local},remote:${remote}`;
        expect(resolveCacheFlag({ TURBO_CACHE: cache }, true)).toBe(cache);
      }
    }
    expect(
      resolveCacheFlag({ TURBO_CACHE: ' local:rw,remote:rw ' }, true)
    ).toBe('local:rw,remote:rw');
    for (const invalid of ['', 'rw', 'local:wr', 'local:read', 'remote:x']) {
      expect(resolveCacheFlag({ TURBO_CACHE: invalid }, true)).toBe(
        'local:rw,remote:rw'
      );
    }
  });
});

describe('turbo-ci-run child env', () => {
  test('defaults TURBO_API and TURBO_TEAM when a token is present', () => {
    const env = turboChildEnv({ TURBO_TOKEN: 'tok' });
    expect(env['TURBO_API']).toBe(DEFAULT_TURBO_API);
    expect(env['TURBO_TEAM']).toBe(TURBO_TEAM);
  });

  test('passes through and strips trailing slash on TURBO_API', () => {
    const env = turboChildEnv({
      TURBO_TOKEN: 'tok',
      TURBO_API: 'https://turborepo.chrisvouga.dev/',
    });
    expect(env['TURBO_API']).toBe(DEFAULT_TURBO_API);
  });

  test('does not invent remote cache settings without a token', () => {
    const env = turboChildEnv({});
    expect(env['TURBO_API']).toBeUndefined();
    expect(env['TURBO_TEAM']).toBeUndefined();
  });

  test('disables telemetry unless the caller set it', () => {
    expect(turboChildEnv({})['TURBO_TELEMETRY_DISABLED']).toBe('1');
    expect(
      turboChildEnv({ TURBO_TELEMETRY_DISABLED: '0' })[
        'TURBO_TELEMETRY_DISABLED'
      ]
    ).toBe('0');
  });
});

describe('turbo-ci-run aggregator flatten', () => {
  const tasks = {
    '//#check': { dependsOn: ['lint', 'tc', 'test'] },
  };

  test('check expands to its leaves', () => {
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
        dependsOn: ['tc', '//#check', 'health'],
      },
      '//#check': { dependsOn: ['lint'] },
    };
    expect(flattenCheckAggregators(['deploy'], withDeploy)).toEqual([
      'tc',
      'lint',
      'health',
    ]);
    expect(flattenCheckAggregators(['//#deploy'], withDeploy)).toEqual([
      'tc',
      'lint',
      'health',
    ]);
  });
});

describe('turbo-ci-run run mode', () => {
  test('standalone health runs only the probes and reports every failure', () => {
    expect(resolveRunMode(['health'])).toBe('health');
    expect(runModeFlags('health')).toEqual([
      '--only',
      '--continue=dependencies-successful',
    ]);
  });

  test('deploy keeps the dependency chain so health runs after it', () => {
    expect(resolveRunMode(['//#deploy'])).toBe('deploy');
    expect(runModeFlags('deploy')).toEqual([]);
  });

  test('check and bare tasks are plain runs', () => {
    expect(resolveRunMode(['check'])).toBe('plain');
    expect(resolveRunMode(['lint', 'tc'])).toBe('plain');
    expect(resolveRunMode(['constructor'])).toBe('plain');
    expect(runModeFlags('plain')).toEqual([]);
  });
});

describe('turbo-ci-run durations', () => {
  test('prints the total and each phase in seconds', () => {
    expect(
      formatDurations(9_140, [
        ['plan', 1_210],
        ['prefetch', 300],
        ['turbo', 7_630],
      ])
    ).toBe(
      'turbo-ci-run: finished in 9.1s (plan 1.2s, prefetch 0.3s, turbo 7.6s)'
    );
  });

  test('a run with no timed phases prints the total alone', () => {
    expect(formatDurations(450, [])).toBe('turbo-ci-run: finished in 0.5s');
  });
});

// regression: local-check-thread-oversubscription
test('local and remote checks bound nested native thread pools identically', () => {
  const local = turboChildEnv({});
  const remote = turboChildEnv({ CI: 'true' });
  for (const key of [
    'RAYON_NUM_THREADS',
    'CHECK_LINT_THREADS',
    'GOMAXPROCS',
    'JAVA_TOOL_OPTIONS',
    'JVM_GC_ARGS',
  ])
    expect(local[key]).toBe(remote[key]);
  expect(local['JAVA_TOOL_OPTIONS']).toBe('-XX:ActiveProcessorCount=1');
  expect(local['JVM_GC_ARGS']).toBe('-XX:+UseParallelGC -Xmx4096m -Xms128m');
  expect(local['GOMAXPROCS']).toBe('1');
  expect(
    turboChildEnv({ JAVA_TOOL_OPTIONS: '-XX:ActiveProcessorCount=2' })[
      'JAVA_TOOL_OPTIONS'
    ]
  ).toBe('-XX:ActiveProcessorCount=2');
});

// regression: local-check-thread-oversubscription
test('task slots reserve CPU capacity for nested native workers', () => {
  expect(defaultCheckConcurrency(12)).toBe(3);
  expect(defaultCheckConcurrency(1)).toBe(1);
  expect(defaultCheckConcurrency(64)).toBe(16);
});
