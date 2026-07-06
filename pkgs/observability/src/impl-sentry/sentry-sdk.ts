import type { Span as SentrySpanType } from '@sentry/core';
import type { StartSpanOptions as SentryStartSpanOptions } from '@sentry/core';

export type SentrySdk = {
  readonly startInactiveSpan: (
    options: SentryStartSpanOptions
  ) => SentrySpanType;
  readonly withActiveSpan: <T>(
    span: SentrySpanType | null,
    callback: () => T
  ) => T;
  readonly spanToTraceparentHeader: (span: SentrySpanType) => string;
  readonly spanToTraceHeader: (span: SentrySpanType) => string;
  readonly spanContext: (
    span: SentrySpanType
  ) => { traceId: string; spanId: string; traceFlags: number };
  readonly continueTrace: <T>(
    options: { sentryTrace?: string; baggage?: string },
    callback: () => T
  ) => T;
  readonly captureException: (error: unknown) => void;
  readonly flush: () => Promise<boolean>;
};

export const SENTRY_TRACE_HEADER = 'sentry-trace';
export const SENTRY_BAGGAGE_HEADER = 'baggage';
