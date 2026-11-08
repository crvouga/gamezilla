import { expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  type PrCheck,
  type RequiredPrCheck,
  requiredPrCheckFailures,
} from './required-pr-checks';

const directory = join(
  import.meta.dirname,
  '../../infra-shared-ts/tofu/modules/repository/required-checks'
);
const required = readdirSync(directory).map(
  (file) =>
    JSON.parse(readFileSync(join(directory, file), 'utf8')) as RequiredPrCheck
);
// PR 292, a42822633d3b1ae93153f093865bf658c254bfe4, run 42427274976.
// Default setup run 42427272789: dynamic/github-code-scanning/codeql.
const codeql: readonly PrCheck[] = [
  { name: 'CodeQL', appId: 57789, status: 'completed', conclusion: 'success' },
  {
    name: 'Analyze (javascript-typescript)',
    appId: 15368,
    status: 'completed',
    conclusion: 'success',
  },
  {
    name: 'Analyze (actions)',
    appId: 15368,
    status: 'completed',
    conclusion: 'success',
  },
];
const checks: readonly PrCheck[] = [
  ...codeql,
  ...[
    'verify:start',
    'verify:shards (0)',
    'verify:shards (1)',
    'verify:shards (2)',
    'verify:shards (3)',
    'verify:shards (4)',
    'verify:shards (5)',
    'verify:shards (6)',
  ].map((name) => ({
    name,
    appId: 15368,
    status: 'completed',
    conclusion: 'success',
  })),
  {
    name: 'verify:end',
    appId: 15368,
    status: 'completed',
    conclusion: 'failure',
  },
];

// regression: codeql-default-setup-unregistered-checks
test('the hosted CodeQL default setup results are required with their exact producers', () => {
  expect(requiredPrCheckFailures(required, checks, false)).toEqual([]);
  for (const check of codeql) {
    expect(required).toContainEqual({
      context: check.name,
      integration_id: check.appId,
    });
    expect(
      requiredPrCheckFailures(
        required,
        checks.filter((entry) => entry !== check),
        false
      )
    ).toContain(`Missing required check: ${check.name} (app ${check.appId})`);
    for (const replacement of [
      { ...check, conclusion: 'failure' },
      { ...check, conclusion: 'neutral' },
      { ...check, status: 'in_progress', conclusion: null },
      { ...check, appId: 123 },
    ]) {
      expect(
        requiredPrCheckFailures(
          required,
          checks.map((entry) => (entry === check ? replacement : entry)),
          false
        )
      ).not.toEqual([]);
    }
  }
});
