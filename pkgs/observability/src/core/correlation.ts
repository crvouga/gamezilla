import {
  type Context,
  context,
  type Link,
  propagation,
  ROOT_CONTEXT,
  trace,
} from '@opentelemetry/api';

const TRACEPARENT = 'traceparent';

export function serializeTraceContext(
  source: Context = context.active()
): string | undefined {
  const carrier: Record<string, string> = {};
  propagation.inject(source, carrier);
  return carrier[TRACEPARENT];
}

export function deserializeTraceContext(
  traceparent: string
): Context | undefined {
  const extracted = propagation.extract(ROOT_CONTEXT, { traceparent });
  return trace.getSpanContext(extracted) === undefined ? undefined : extracted;
}

export function linkFromTraceparent(traceparent: string): Link | undefined {
  const extracted = deserializeTraceContext(traceparent);
  if (extracted === undefined) return undefined;
  const spanContext = trace.getSpanContext(extracted);
  return spanContext === undefined ? undefined : { context: spanContext };
}

export function currentCorrelation(): {
  readonly traceId?: string;
  readonly spanId?: string;
  readonly traceparent?: string;
} {
  const spanContext = trace.getSpanContext(context.active());
  if (spanContext === undefined) return {};
  const traceparent = serializeTraceContext();
  return {
    traceId: spanContext.traceId,
    spanId: spanContext.spanId,
    ...(traceparent === undefined ? {} : { traceparent }),
  };
}
