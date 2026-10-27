import { ATTR } from '@pkgs/observability-root-shared-ts/attributes';

export type FailedTestTrace = {
  readonly file?: string;
  readonly packageName?: string;
  readonly spanId: string;
  readonly summary: string;
  readonly testId: string;
  readonly traceId: string;
};

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord | undefined {
  return value !== null && typeof value === 'object'
    ? (value as UnknownRecord)
    : undefined;
}

function string(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/** Pull only runner-authored test.failure records from an NDJSON artifact. */
export function failedTestTracesFromNdjson(text: string): FailedTestTrace[] {
  const failures: FailedTestTrace[] = [];
  for (const line of text.split('\n')) {
    if (line.trim() === '') continue;
    try {
      const span = record(JSON.parse(line));
      const attributes = record(span?.['attributes']);
      const testId = string(attributes?.[ATTR.APP_TEST_ID]);
      const traceId = string(span?.['traceId']);
      const spanId = string(span?.['spanId']);
      const file = string(attributes?.[ATTR.APP_TEST_FILE]);
      const packageName = string(attributes?.[ATTR.APP_TEST_PACKAGE]);
      if (
        span?.['name'] !== 'test.failure' ||
        span?.['status'] !== 'error' ||
        testId === undefined ||
        traceId === undefined ||
        spanId === undefined
      )
        continue;
      failures.push({
        testId,
        traceId,
        spanId,
        summary: string(span?.['statusMessage']) ?? 'test failed',
        ...(file === undefined ? {} : { file }),
        ...(packageName === undefined ? {} : { packageName }),
      });
    } catch {
      // A concurrently appended trailing line is allowed to be incomplete.
    }
  }
  return failures;
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

export function failedTestTraceMarkdown(
  failures: readonly FailedTestTrace[],
  runId: string
): string {
  if (failures.length === 0) return '';
  const unique = [
    ...new Map(
      failures.map((failure) => [
        `${failure.traceId}:${failure.spanId}`,
        failure,
      ])
    ).values(),
  ].sort((left, right) => left.testId.localeCompare(right.testId));
  const lines = [
    '### Queryable test failures',
    '',
    'The runner correlated these failures from Bun JUnit without a rerun:',
    '',
  ];
  for (const failure of unique) {
    const location = [failure.packageName, failure.file]
      .filter((value): value is string => value !== undefined)
      .join(' / ');
    lines.push(`#### ${failure.testId}`);
    if (location !== '') lines.push(`- location: \`${location}\``);
    lines.push(`- failure: ${failure.summary.replaceAll('\n', ' ')}`);
    lines.push(`- trace: \`${failure.traceId}\``);
    lines.push(`- span: \`${failure.spanId}\``);
    lines.push('');
    lines.push('```sh');
    lines.push(
      `bun run libs/secrets-server-ts/scripts/secrets-run.ts -- bun run libs/tools-harness-ts/scripts/ci-artifacts.ts --run ${runId} download-all observability-traces- artifacts`
    );
    lines.push(
      `bun obs test ${shellQuote(failure.testId)} --source artifacts --last-failure`
    );
    lines.push(`bun obs trace ${failure.traceId} --source artifacts`);
    lines.push(
      `bun obs span ${failure.traceId} ${failure.spanId} --source artifacts`
    );
    lines.push('```', '');
  }
  return lines.join('\n');
}
