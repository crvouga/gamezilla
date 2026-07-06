import {
  extractTraceContext,
  injectTraceContext,
  TRACEPARENT_HEADER,
} from '../shared/trace-context';
import type { SpanContext } from '../shared/types';
import type { SentrySdk } from './sentry-sdk';
import { SENTRY_BAGGAGE_HEADER, SENTRY_TRACE_HEADER } from './sentry-sdk';

export function injectPropagationHeaders(args: {
  sdk: SentrySdk;
  context: SpanContext;
  sentrySpan: Parameters<SentrySdk['spanToTraceHeader']>[0] | undefined;
  carrier: Record<string, string>;
}): void {
  injectTraceContext(args.context, args.carrier);
  if (args.sentrySpan !== undefined) {
    args.carrier[SENTRY_TRACE_HEADER] = args.sdk.spanToTraceHeader(
      args.sentrySpan
    );
    const traceparent = args.sdk.spanToTraceparentHeader(args.sentrySpan);
    if (traceparent.length > 0) {
      args.carrier[TRACEPARENT_HEADER] = traceparent;
    }
  }
}

export function extractPropagationContext(
  carrier: Record<string, string>
): SpanContext | undefined {
  const fromTraceparent = extractTraceContext(carrier);
  if (fromTraceparent !== undefined) return fromTraceparent;
  const sentryTrace = carrier[SENTRY_TRACE_HEADER];
  if (sentryTrace === undefined || sentryTrace.length === 0) return undefined;
  return undefined;
}

export function readPropagationCarrier(
  carrier: Record<string, string>
): { sentryTrace?: string; baggage?: string } {
  const sentryTrace = carrier[SENTRY_TRACE_HEADER];
  const baggage = carrier[SENTRY_BAGGAGE_HEADER];
  return {
    ...(sentryTrace !== undefined && sentryTrace.length > 0
      ? { sentryTrace }
      : {}),
    ...(baggage !== undefined && baggage.length > 0 ? { baggage } : {}),
  };
}
