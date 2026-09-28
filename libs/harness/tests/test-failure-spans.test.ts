import { expect, test } from 'bun:test';
import { testFailureSpans } from '@libs/harness';
import { ATTR } from '@pkgs/observability/core';

const OPTIONS = {
  buildSha: 'abc123',
  ciRunId: '42',
  completedAtMs: 1_800_000_000_000,
  environment: 'ci' as const,
  packageName: '@libs/example',
  serviceName: 'example-e2e',
};

test('failed JUnit cases become deterministic exact-name traces', () => {
  const cases = [
    {
      file: 'tests/e2e/example.test.ts',
      name: 'offline edits converge',
      line: 12,
      status: 'failed' as const,
      failure: 'expected replicas to converge\nstack line',
    },
  ];
  const first = testFailureSpans(cases, OPTIONS);
  const second = testFailureSpans(cases, OPTIONS);
  expect(first).toEqual(second);
  expect(first).toHaveLength(1);
  expect(first[0]?.status).toBe('error');
  expect(first[0]?.attributes[ATTR.APP_TEST_ID]).toBe('offline edits converge');
  expect(first[0]?.attributes[ATTR.APP_TEST_FILE]).toBe(
    'tests/e2e/example.test.ts'
  );
});

test('passed and skipped JUnit cases do not create failure traces', () => {
  const cases = [
    {
      file: 'tests/e2e/example.test.ts',
      name: 'passes',
      line: 1,
      status: 'passed' as const,
      failure: null,
    },
    {
      file: 'tests/e2e/example.test.ts',
      name: 'skips',
      line: 2,
      status: 'skipped' as const,
      failure: null,
    },
  ];
  expect(testFailureSpans(cases, OPTIONS)).toEqual([]);
});
