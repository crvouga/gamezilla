import type { ObservabilityBackend } from '../shared/backend';
import {
  extractTraceContext,
  injectTraceContext,
} from '../shared/trace-context';
import type { StartSpanOptions, SpanContext } from '../shared/types';
import { BaseSpan } from './base-span';
import type {
  Observability,
  SpanContextStorage,
  SpanExporter,
} from './observability';

export class BaseObservability implements Observability {
  readonly serviceName: string;
  readonly backend: ObservabilityBackend;
  private readonly storage: SpanContextStorage;
  private readonly exporter: SpanExporter;

  constructor(args: {
    readonly serviceName: string;
    readonly backend: ObservabilityBackend;
    readonly storage: SpanContextStorage;
    readonly exporter: SpanExporter;
  }) {
    this.serviceName = args.serviceName;
    this.backend = args.backend;
    this.storage = args.storage;
    this.exporter = args.exporter;
  }

  activeSpanContext() {
    return this.storage.active();
  }

  withSpanContext<T>(ctx: SpanContext, fn: () => T): T {
    return this.storage.runWith(ctx, fn);
  }

  withSpanContextAsync<T>(ctx: SpanContext, fn: () => Promise<T>): Promise<T> {
    return this.storage.runWithAsync(ctx, fn);
  }

  startSpan(options: StartSpanOptions) {
    const parent = options.parent ?? this.activeSpanContext();
    return new BaseSpan({
      serviceName: this.serviceName,
      name: options.name,
      kind: options.kind ?? 'internal',
      exporter: this.exporter,
      ...(parent !== undefined ? { parent } : {}),
      ...(options.attributes !== undefined
        ? { attributes: options.attributes }
        : {}),
    });
  }

  recordException(error: unknown, attributes?: Record<string, string>): void {
    const active = this.activeSpanContext();
    if (active === undefined) return;
    const span = this.startSpan({
      name: 'exception',
      kind: 'internal',
      parent: active,
      attributes: {
        ...(attributes ?? {}),
        'exception.type': error instanceof Error ? error.name : typeof error,
        'exception.message':
          error instanceof Error ? error.message : String(error),
      },
    });
    span.setStatus({
      code: 'error',
      message: error instanceof Error ? error.message : String(error),
    });
    span.end();
  }

  inject(context: SpanContext, carrier: Record<string, string>): void {
    injectTraceContext(context, carrier);
  }

  extract(carrier: Record<string, string>) {
    return extractTraceContext(carrier);
  }

  async shutdown(): Promise<void> {
    /* noop by default */
  }
}
