import { expect, test } from 'bun:test';
import type { JunitCase } from '@crvouga/atlas/reports/junit';
import { testFailureSpans } from '@libs/harness-ts/test-failure-spans';
import { ATTR } from '@pkgs/observability-root-shared-ts/attributes';

const OPTIONS = {
  buildSha: 'abc123',
  ciRunId: '42',
  completedAtMs: 1_800_000_000_000,
  environment: 'ci' as const,
  packageName: '@libs/example',
  serviceName: 'example-spec',
};

test('failed JUnit cases become deterministic exact-name traces', () => {
  const cases = [
    {
      file: 'tests/harness/example.test.ts',
      name: 'offline edits converge',
      classname: 'example',
      suite: 'harness',
      time: 0,
      name: 'offline edits converge',
      line: 12,
      status: 'failed' as const,
      failure: 'expected replicas to converge\nstack line',
    },
  ] satisfies readonly JunitCase[];
  const first = testFailureSpans(cases, OPTIONS);
  const second = testFailureSpans(cases, OPTIONS);
  expect(first).toEqual(second);
  expect(first).toHaveLength(1);
  expect(first[0]?.status).toBe('error');
  expect(first[0]?.attributes[ATTR.APP_TEST_ID]).toBe('offline edits converge');
  expect(first[0]?.attributes[ATTR.APP_TEST_FILE]).toBe(
    'tests/harness/example.test.ts'
  );
});

test('passed and skipped JUnit cases do not create failure traces', () => {
  const cases = [
    {
      file: 'tests/harness/example.test.ts',
      name: 'passes',
      classname: 'example',
      suite: 'harness',
      time: 0,
      name: 'passes',
      line: 1,
      status: 'passed' as const,
      failure: null,
    },
    {
      file: 'tests/harness/example.test.ts',
      name: 'skips',
      classname: 'example',
      suite: 'harness',
      time: 0,
      name: 'skips',
      line: 2,
      status: 'skipped' as const,
      failure: null,
    },
  ] satisfies readonly JunitCase[];
  expect(testFailureSpans(cases, OPTIONS)).toEqual([]);
});
