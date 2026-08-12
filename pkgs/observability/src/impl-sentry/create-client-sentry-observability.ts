import {
  captureException,
  continueTrace,
  flush,
  spanToTraceHeader,
  startInactiveSpan,
  withActiveSpan,
} from '@sentry/core';
import { InMemorySpanContextStorage } from '../port/in-memory-context-storage';
import type { Observability, SpanContextStorage } from '../port/observability';
import { formatTraceparent } from '../shared/trace-context';
import { createSentryObservability } from './sentry-observability';
import type { SentrySdk } from './sentry-sdk';

function createClientSentrySdk(): SentrySdk {
  return {
    startInactiveSpan: (options) => startInactiveSpan(options),
    withActiveSpan: (span, callback) => withActiveSpan(span, callback),
    spanToTraceparentHeader: (span) => {
      const ctx = span.spanContext();
      return formatTraceparent({
        traceId: ctx.traceId,
        spanId: ctx.spanId,
        traceFlags: ctx.traceFlags & 0x1,
      });
    },
    spanToTraceHeader: (span) => spanToTraceHeader(span),
    spanContext: (span) => span.spanContext(),
    continueTrace: (options, callback) =>
      continueTrace(
        {
          sentryTrace: options.sentryTrace,
          baggage: options.baggage,
        },
        callback
      ),
    captureException: (error) => {
      captureException(error);
    },
    flush: () => flush(),
  };
}

export function createClientSentryObservability(args: {
  readonly serviceName: string;
  readonly now: () => number;
  readonly storage?: SpanContextStorage;
}): Observability {
  return createSentryObservability({
    serviceName: args.serviceName,
    sdk: createClientSentrySdk(),
    storage: args.storage ?? new InMemorySpanContextStorage(),
    now: args.now,
  });
}
