import { expect, test } from 'bun:test';
import { HARNESS_AUTH_SECRET } from '@libs/sub-shared/harness-constants';
import { DEFAULT_SYNTHETIC_POPULATION_CONFIG } from '@libs/synthetic-population-shared/config';
import { localApiEnv } from './local-api-env';
import { localPopulationConfig } from './local-population-config';
import { localProcessEnv } from './local-process-env';
import { parseStackOptions } from './stack-options';
import { stackSuiteArgs } from './stack-suite-args';

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
    stack: ['--api-nodes', '2'],
    suite: ['specs/profile/apple-sign-in.feature', '-t', 'Apple'],
  });
});

test('stack sessions use the same signing authority as harness assertions', () => {
  // regression: local-stack-auth-authority-mismatch
  const env = localApiEnv({
    AUTH_SECRET: 'unrelated-parent-key',
    SECRETS_ENV: 'prd',
  });
  expect(env.AUTH_SECRET).toBe(HARNESS_AUTH_SECRET);
  expect(env.SECRETS_ENV).toBe('dev');
});
