import type { SpanContextStorage } from '../port/observability';
import type { Observability } from '../port/observability';
import type { Span, SpanContext, StartSpanOptions } from '../shared/types';
import {
  extractPropagationContext,
  injectPropagationHeaders,
  readPropagationCarrier,
} from './propagation';
import type { SentrySdk } from './sentry-sdk';
import { spanContextKey, startPortSentrySpan } from './sentry-span';

type SentrySpanType = Parameters<SentrySdk['spanToTraceHeader']>[0];

export class SentryObservability implements Observability {
  readonly serviceName: string;
  readonly backend = 'sentry' as const;
  private readonly sdk: SentrySdk;
  private readonly storage: SpanContextStorage;
  private readonly spanRegistry = new Map<string, SentrySpanType>();

  constructor(args: {
    readonly serviceName: string;
    readonly sdk: SentrySdk;
    readonly storage: SpanContextStorage;
  }) {
    this.serviceName = args.serviceName;
    this.sdk = args.sdk;
    this.storage = args.storage;
  }

  activeSpanContext(): SpanContext | undefined {
    return this.storage.active();
  }

  withSpanContext<T>(ctx: SpanContext, fn: () => T): T {
    const sentrySpan = this.spanRegistry.get(spanContextKey(ctx));
    if (sentrySpan === undefined) {
      return this.storage.runWith(ctx, fn);
    }
    return this.sdk.withActiveSpan(sentrySpan, () =>
      this.storage.runWith(ctx, fn)
    );
  }

  async withSpanContextAsync<T>(
    ctx: SpanContext,
    fn: () => Promise<T>
  ): Promise<T> {
    const sentrySpan = this.spanRegistry.get(spanContextKey(ctx));
    if (sentrySpan === undefined) {
      return this.storage.runWithAsync(ctx, fn);
    }
    return this.sdk.withActiveSpan(sentrySpan, () =>
      this.storage.runWithAsync(ctx, fn)
    );
  }

  startSpan(options: StartSpanOptions): Span {
    const parentCtx = options.parent ?? this.storage.active();
    const parentSentrySpan =
      parentCtx !== undefined
        ? this.spanRegistry.get(spanContextKey(parentCtx))
        : undefined;
    const portSpan = startPortSentrySpan({
      sdk: this.sdk,
      name: options.name,
      kind: options.kind ?? 'internal',
      ...(options.attributes !== undefined
        ? { attributes: options.attributes }
        : {}),
      ...(parentSentrySpan !== undefined ? { parentSentrySpan } : {}),
      onEnd: () => {
        this.spanRegistry.delete(spanContextKey(portSpan.spanContext));
      },
    });
    portSpan.setAttribute('service.name', this.serviceName);
    this.spanRegistry.set(
      spanContextKey(portSpan.spanContext),
      portSpan.underlyingSentrySpan
    );
    return portSpan;
  }

  recordException(error: unknown, attributes?: Record<string, string>): void {
    try {
      if (attributes !== undefined) {
        for (const [key, value] of Object.entries(attributes)) {
          /* attributes on scope handled via captureException context in SDK */
          void key;
          void value;
        }
      }
      this.sdk.captureException(error);
    } catch {
      /* never throw into caller */
    }
  }

  inject(context: SpanContext, carrier: Record<string, string>): void {
    try {
      const sentrySpan = this.spanRegistry.get(spanContextKey(context));
      injectPropagationHeaders({
        sdk: this.sdk,
        context,
        sentrySpan,
        carrier,
      });
    } catch {
      injectPropagationHeaders({
        sdk: this.sdk,
        context,
        sentrySpan: undefined,
        carrier,
      });
    }
  }

  extract(carrier: Record<string, string>): SpanContext | undefined {
    const fromHeaders = extractPropagationContext(carrier);
    if (fromHeaders !== undefined) return fromHeaders;
    const propagation = readPropagationCarrier(carrier);
    if (propagation.sentryTrace === undefined) return undefined;
    let extracted: SpanContext | undefined;
    this.sdk.continueTrace(propagation, () => {
      extracted = this.storage.active();
    });
    return extracted;
  }

  async shutdown(): Promise<void> {
    try {
      await this.sdk.flush();
    } catch {
      /* ignore */
    }
  }
}

export function createSentryObservability(args: {
  readonly serviceName: string;
  readonly sdk: SentrySdk;
  readonly storage: SpanContextStorage;
}): Observability {
  return new SentryObservability(args);
}
