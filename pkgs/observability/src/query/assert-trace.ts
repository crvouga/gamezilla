import type { Trace } from './types';

export type ExpectedSpan = {
  readonly name: string;
  readonly status?: 'unset' | 'ok' | 'error';
};

export function traceHasSpan(trace: Trace, expected: ExpectedSpan): boolean {
  return trace.spans.some(
    (span) =>
      span.name === expected.name &&
      (expected.status === undefined || span.status === expected.status)
  );
}

export function assertTraceHasSpan(trace: Trace, expected: ExpectedSpan): void {
  if (traceHasSpan(trace, expected)) return;
  const actual = trace.spans
    .map((span) => `${span.name}[${span.status}]`)
    .sort()
    .join(', ');
  throw new Error(
    `Expected trace ${trace.traceId} to contain ${expected.name}` +
      `${expected.status === undefined ? '' : `[${expected.status}]`}; ` +
      `actual spans: ${actual || '(none)'}`
  );
}
