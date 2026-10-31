import { expect, test } from 'bun:test';
import { HARNESS_AUTH_SECRET } from '@libs/sub-shared-ts/harness-constants';
import { DEFAULT_SYNTHETIC_POPULATION_CONFIG } from '@libs/synthetic-population-shared-ts/config';
import { localApiEnv } from './local-api-env';
import { localPopulationConfig } from './local-population-config';
import { localProcessEnv } from './local-process-env';
import { isolatedSharedDataEnv } from './local-shared-data-env';
import { parseStackOptions } from './stack-options';
import { stackSuiteArgs } from './stack-suite-args';

// regression: workspace-local-shared-data-login
test('local reference data uses disposable bindings even with deployed credentials present', () => {
  const shared = {
    SHARED_DATA_BUCKET: 'acme-shared',
    SHARED_DATA_ENDPOINT: 'https://r2.example',
    SHARED_DATA_REGION: 'auto',
    SHARED_DATA_ACCESS_KEY_ID: 'shared-key',
    SHARED_DATA_SECRET_ACCESS_KEY: 'shared-secret',
  };
  expect(
    isolatedSharedDataEnv({
      S3_BUCKET: 'disposable',
      S3_ENDPOINT: 'http://127.0.0.1:10001',
      S3_REGION: 'auto',
      S3_ACCESS_KEY_ID: 'test-key',
      S3_SECRET_ACCESS_KEY: 'test-secret',
      ...shared,
    })
  ).toEqual({
    SHARED_DATA_BUCKET: 'disposable',
    SHARED_DATA_ENDPOINT: 'http://127.0.0.1:10001',
    SHARED_DATA_REGION: 'auto',
    SHARED_DATA_ACCESS_KEY_ID: 'test-key',
    SHARED_DATA_SECRET_ACCESS_KEY: 'test-secret',
  });
});

test('a default local stack admits a synthetic opponent', () => {
  // regression: local-population-zero-desired
  const options = parseStackOptions(['--instance', 'local']);
  const config = localPopulationConfig(
    DEFAULT_SYNTHETIC_POPULATION_CONFIG,
    options.syntheticPopulationWorkers
  );
  expect(config.desired).toBe(1);
  expect(config.capacityPerWorker).toBe(1);
  expect(config.preferredVersion).toBe('local');
  expect(DEFAULT_SYNTHETIC_POPULATION_CONFIG.desired).toBe(0);
  expect(localPopulationConfig(config, 0).desired).toBe(0);
  expect(localPopulationConfig({ ...config, revision: 9 }, 3)).toMatchObject({
    desired: 3,
    revision: 9,
  });
});

test('local processes inherit plumbing but no deployed service credentials', () => {
  // regression: local-stack-inherited-cloud-bindings
  expect(
    localProcessEnv({
      PATH: '/bin',
      HOME: '/home/developer',
      TERM: 'xterm',
      DATABASE_URL: 'postgres://cloud.example/db',
      REPORTS_ENDPOINT: 'https://cloud.example',
      AWS_ACCESS_KEY_ID: 'outside',
      GOOGLE_IDP_ORIGIN: 'https://accounts.google.com',
      OBSERVABILITY_COLLECTOR_URL: 'https://traces.example',
      VITE_API_URL: 'https://api.example',
      BUN_ENV_FILE: '/tmp/secrets',
    })
  ).toEqual({ PATH: '/bin', HOME: '/home/developer', TERM: 'xterm' });
});

test('missing cloud reports credentials cannot block local startup', () => {
  // regression: local-stack-missing-reports-credentials
  const empty = localApiEnv({});
  const cloud = localApiEnv({
    REPORTS_BUCKET: 'shared-cloud',
    REPORTS_ENDPOINT: 'https://outside.example',
    REPORTS_ACCESS_KEY_ID: 'key',
    REPORTS_SECRET_ACCESS_KEY: 'secret',
  });
  expect(empty).toEqual(cloud);
  expect(empty).not.toHaveProperty('REPORTS_ENDPOINT');
});

test('a feature path selects a suite and trailing flags select its scenarios', () => {
  // regression: stack-runner-drops-feature-selection
  expect(
    stackSuiteArgs([
      '--api-nodes',
      '2',
      'specs/profile/apple-sign-in.feature',
      '--',
      '-t',
      'Apple',
    ])
  ).toEqual({
    stack: ['--api-nodes', '2', '--synthetic-population-workers=0'],
    suite: ['specs/profile/apple-sign-in.feature', '-t', 'Apple'],
  });
});

test('stack sessions use the same signing authority as harness assertions', () => {
  // regression: local-stack-auth-authority-mismatch
  // regression: release-journey-monitor-unconfigured
  const env = localApiEnv({
    AUTH_SECRET: 'unrelated-parent-key',
    SECRETS_ENV: 'prd',
    SYNTHETIC_MONITOR_TOKEN: 'unrelated-production-monitor',
  });
  expect(env.AUTH_SECRET).toBe(HARNESS_AUTH_SECRET);
  expect(env.SECRETS_ENV).toBe('dev');
  expect(env.SYNTHETIC_MONITOR_TOKEN.length).toBeGreaterThanOrEqual(32);
  expect(env.SYNTHETIC_MONITOR_TOKEN).not.toBe('unrelated-production-monitor');
});

test('isolated stack suites have no uninvited matchmaking participants', () => {
  // regression: stack-tests-background-opponent
  expect(
    parseStackOptions(stackSuiteArgs([]).stack).syntheticPopulationWorkers
  ).toBe(0);
  expect(
    parseStackOptions(
      stackSuiteArgs(['--synthetic-population-workers', '2']).stack
    ).syntheticPopulationWorkers
  ).toBe(2);
  expect(
    parseStackOptions(
      stackSuiteArgs(['--synthetic-population-workers=1']).stack
    ).syntheticPopulationWorkers
  ).toBe(1);
  expect(parseStackOptions([]).syntheticPopulationWorkers).toBe(1);
});
