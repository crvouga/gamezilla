import * as Sentry from '@sentry/cloudflare';
import { continueTrace, spanToTraceHeader } from '@sentry/core';

import { formatTraceparent } from '../shared/trace-context';

import { createAsyncLocalSpanContextStorage } from '../server/context-storage';
import type { SpanContextStorage } from '../port/observability';
import type { Observability } from '../port/observability';
import { createSentryObservability } from './sentry-observability';
import type { SentrySdk } from './sentry-sdk';

function createCloudflareSentrySdk(): SentrySdk {
  return {
    startInactiveSpan: (options) => Sentry.startInactiveSpan(options),
    withActiveSpan: (span, callback) => Sentry.withActiveSpan(span, callback),
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
      Sentry.captureException(error);
    },
    flush: () => Sentry.flush(),
  };
}

export function createServerSentryObservability(args: {
  readonly serviceName: string;
  readonly storage?: SpanContextStorage;
}): Observability {
  return createSentryObservability({
    serviceName: args.serviceName,
    sdk: createCloudflareSentrySdk(),
    storage: args.storage ?? createAsyncLocalSpanContextStorage(),
  });
}
