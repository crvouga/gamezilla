import type { JunitCase } from '@crvouga/atlas/reports/junit';
import { ATTR } from '@pkgs/observability-root-shared/attributes';
import type { NarrateSpan } from '@pkgs/observability-root-shared/narrate';

export type TestFailureSpanOptions = {
  readonly buildSha: string;
  readonly ciRunId?: string;
  readonly completedAtMs: number;
  readonly environment: 'ci' | 'test';
  readonly packageName: string;
  readonly serviceName: string;
};

const FNV_OFFSET = 0xcbf29ce484222325n;
const FNV_PRIME = 0x100000001b3n;
const UINT64_MASK = 0xffffffffffffffffn;
const MAX_STATUS_MESSAGE = 512;
const MAX_EXCEPTION_TEXT = 8_192;

function hash64(value: string, salt: string): string {
  let hash = FNV_OFFSET;
  for (const character of `${salt}:${value}`) {
    hash ^= BigInt(character.codePointAt(0) ?? 0);
    hash = (hash * FNV_PRIME) & UINT64_MASK;
  }
  return hash.toString(16).padStart(16, '0');
}

function testKey(testCase: JunitCase, packageName: string): string {
  return [
    packageName,
    testCase.file,
    String(testCase.line ?? 0),
    testCase.name,
  ].join('::');
}

function bounded(value: string, limit: number): string {
  if (value.length <= limit) return value;
  return `${value.slice(0, limit - 1)}…`;
}

/**
 * Materialize runner failures as queryable spans after Bun has emitted JUnit.
 * Bun's preload hooks do not expose a stable current-test identity, especially
 * under parallel execution, while JUnit is the runner's authoritative mapping.
 */
export function testFailureSpans(
  cases: readonly JunitCase[],
  options: TestFailureSpanOptions
): NarrateSpan[] {
  return cases
    .filter(
      (testCase): testCase is JunitCase & { readonly failure: string } =>
        testCase.status === 'failed' && testCase.failure !== null
    )
    .map((testCase) => {
      const key = testKey(testCase, options.packageName);
      const failure = bounded(testCase.failure, MAX_EXCEPTION_TEXT);
      return {
        traceId: `${hash64(key, 'trace-a')}${hash64(key, 'trace-b')}`,
        spanId: hash64(key, 'span'),
        name: 'test.failure',
        startTimeMs: options.completedAtMs,
        durationMs: 0,
        status: 'error' as const,
        statusMessage: bounded(
          failure.split('\n')[0] ?? 'test failed',
          MAX_STATUS_MESSAGE
        ),
        attributes: {
          [ATTR.SERVICE_NAME]: options.serviceName,
          [ATTR.SERVICE_VERSION]: options.buildSha,
          [ATTR.DEPLOYMENT_ENVIRONMENT_NAME]: options.environment,
          [ATTR.APP_BUILD_SHA]: options.buildSha,
          [ATTR.APP_TEST_ID]: testCase.name,
          [ATTR.APP_TEST_PACKAGE]: options.packageName,
          [ATTR.APP_TEST_FILE]: testCase.file,
          ...(testCase.line === null
            ? {}
            : { [ATTR.APP_TEST_LINE]: testCase.line }),
          ...(options.ciRunId === undefined
            ? {}
            : { [ATTR.APP_CI_RUN_ID]: options.ciRunId }),
        },
        events: [
          {
            name: 'exception',
            timeMs: options.completedAtMs,
            attributes: {
              [ATTR.EXCEPTION_TYPE]: 'BunTestFailure',
              [ATTR.EXCEPTION_MESSAGE]: failure,
            },
          },
        ],
        links: [],
      };
    });
}
