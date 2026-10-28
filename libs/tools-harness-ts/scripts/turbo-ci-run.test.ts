import { describe, expect, test } from 'bun:test';

import {
  DEFAULT_TURBO_API,
  TURBO_TEAM,
} from '@libs/secrets-shared-ts/turbo-token';
import {
  defaultVerifyConcurrency,
  flattenVerifyAggregators,
  formatDurations,
  hasRemoteCreds,
  resolveCacheFlag,
  resolveRunMode,
  resolveUi,
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

  // regression: verify-cache-write-only-override
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

  test('an empty replay budget is no budget, and a set one is kept', () => {
    // The Verify workflow sets the variable to empty unless it explores; turbo
    // would hash that apart from a run that never set it.
    expect('QUINT_REPLAY_TRACES' in turboChildEnv({})).toBe(false);
    for (const empty of ['', '  '])
      expect(
        'QUINT_REPLAY_TRACES' in turboChildEnv({ QUINT_REPLAY_TRACES: empty })
      ).toBe(false);
    expect(
      turboChildEnv({ QUINT_REPLAY_TRACES: 'all' })['QUINT_REPLAY_TRACES']
    ).toBe('all');
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
    '//#deploy': { dependsOn: ['health'] },
  };

  test('verification expands to its leaves', () => {
    const leaves = flattenVerifyAggregators(['verify'], tasks);
    expect(leaves).toContain('@libs/tools-harness-ts#verify:root-lint');
    expect(leaves).toContain(
      '@apps/synthetic-population-worker-ts#verify:synthetic-population-foundation'
    );
    expect(leaves).not.toContain('verify:synthetic-population');
    expect(leaves).not.toContain('//#verify');
  });

  test('non-aggregator args pass through', () => {
    expect(flattenVerifyAggregators(['lint', 'tc'], tasks)).toEqual([
      'lint',
      'tc',
    ]);
  });

  test('release expands to //#release leaves', () => {
    const withDeploy = {
      ...tasks,
      '//#deploy': { dependsOn: ['tc', 'health'] },
    };
    expect(flattenVerifyAggregators(['deploy'], withDeploy)).toEqual([
      'tc',
      'health',
    ]);
    expect(flattenVerifyAggregators(['//#deploy'], withDeploy)).toEqual([
      'tc',
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

  test('release keeps the dependency chain so health runs after it', () => {
    expect(resolveRunMode(['//#deploy'])).toBe('deploy');
    expect(runModeFlags('deploy')).toEqual([]);
  });

  test('verification and bare tasks are plain runs', () => {
    expect(resolveRunMode(['verify'])).toBe('plain');
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

// regression: local-verify-thread-oversubscription
test('local and remote verifications bound nested native thread pools identically', () => {
  const local = turboChildEnv({});
  const remote = turboChildEnv({ CI: 'true' });
  for (const key of [
    'RAYON_NUM_THREADS',
    'VERIFY_LINT_THREADS',
    'GOMAXPROCS',
    'JAVA_TOOL_OPTIONS',
    'JVM_GC_ARGS',
    'MODEL_VERIFY_CONCURRENCY',
  ])
    expect(local[key]).toBe(remote[key]);
  expect(local['JAVA_TOOL_OPTIONS']).toBe('-XX:ActiveProcessorCount=2');
  expect(local['MODEL_VERIFY_CONCURRENCY']).toBe('2');
  expect(local['JVM_GC_ARGS']).toBe('-XX:+UseParallelGC -Xmx4096m -Xms128m');
  expect(local['GOMAXPROCS']).toBe('1');
  expect(
    turboChildEnv({ JAVA_TOOL_OPTIONS: '-XX:ActiveProcessorCount=2' })[
      'JAVA_TOOL_OPTIONS'
    ]
  ).toBe('-XX:ActiveProcessorCount=2');
});

// regression: local-verify-thread-oversubscription
test('task slots reserve CPU capacity for nested native workers', () => {
  expect(defaultVerifyConcurrency(12, 4)).toBe(8);
  expect(defaultVerifyConcurrency(2, 1)).toBe(1);
  expect(defaultVerifyConcurrency(64, 4)).toBe(60);
});

describe('turbo UI', () => {
  test('turbo.json chooses the UI unless the caller names one', () => {
    expect(resolveUi({})).toBeUndefined();
    expect(resolveUi({ TURBO_UI: 'stream' })).toBe('stream');
    expect(resolveUi({ TURBO_UI: ' tui ' })).toBe('tui');
    expect(resolveUi({ TURBO_UI: 'fancy' })).toBeUndefined();
  });

  test("a run inside a task streams into that task's pane", () => {
    expect(resolveUi({ TURBO_HASH: 'abc', TURBO_UI: 'tui' })).toBe('stream');
  });
});
