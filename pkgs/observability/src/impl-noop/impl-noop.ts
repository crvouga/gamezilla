import type { Observability } from '../port/observability';
import { createSpanId, createTraceId } from '../shared/ids';
import {
  extractTraceContext,
  injectTraceContext,
  sampledSpanContext,
} from '../shared/trace-context';
import type { Span, SpanContext, StartSpanOptions } from '../shared/types';

class NoopSpan implements Span {
  readonly spanContext: SpanContext;

  constructor(options?: StartSpanOptions) {
    const traceId = options?.parent?.traceId ?? createTraceId();
    const spanId = createSpanId();
    this.spanContext = sampledSpanContext(traceId, spanId);
  }

  setAttribute(): void {}
  addEvent(): void {}
  setStatus(): void {}
  end(): void {}
}

let sharedNoopSpan: NoopSpan | undefined;

function getSharedNoopSpan(): NoopSpan {
  sharedNoopSpan ??= new NoopSpan();
  return sharedNoopSpan;
}

export function createNoopObservability(serviceName: string): Observability {
  return {
    serviceName,
    backend: 'noop',
    activeSpanContext(): SpanContext | undefined {
      return undefined;
    },
    withSpanContext<T>(_: SpanContext, fn: () => T): T {
      return fn();
    },
    async withSpanContextAsync<T>(
      _: SpanContext,
      fn: () => Promise<T>
    ): Promise<T> {
      return await fn();
    },
    startSpan(options: StartSpanOptions): Span {
      if (options.parent !== undefined) {
        return new NoopSpan(options);
      }
      return getSharedNoopSpan();
    },
    recordException(): void {},
    inject(context: SpanContext, carrier: Record<string, string>): void {
      injectTraceContext(context, carrier);
    },
    extract(carrier: Record<string, string>): SpanContext | undefined {
      return extractTraceContext(carrier);
    },
    async shutdown(): Promise<void> {},
  };
}
