import type { CreateId } from '@pkgs/uuid';

import { createSpanId, createTraceId } from '../shared/ids';
import { sampledSpanContext } from '../shared/trace-context';
import type {
  ExportedSpanRecord,
  Span,
  SpanAttributes,
  SpanContext,
  SpanKind,
  SpanStatus,
} from '../shared/types';
import type { SpanExporter } from './observability';

type SpanEvent = {
  readonly name: string;
  readonly timestamp: string;
  readonly attributes?: SpanAttributes;
};

export class BaseSpan implements Span {
  readonly spanContext: SpanContext;
  private readonly now: () => number;
  private readonly startedAt: number;
  private readonly attributes: SpanAttributes;
  private readonly events: SpanEvent[] = [];
  private readonly exporter: SpanExporter;
  private readonly serviceName: string;
  private readonly name: string;
  private readonly kind: SpanKind;
  private readonly parentSpanId?: string;
  private status: SpanStatus = { code: 'ok' };
  private ended = false;

  constructor(args: {
    readonly serviceName: string;
    readonly name: string;
    readonly kind: SpanKind;
    readonly exporter: SpanExporter;
    readonly now: () => number;
    readonly createId: CreateId;
    readonly parent?: SpanContext;
    readonly attributes?: SpanAttributes;
    readonly traceId?: string;
    readonly spanId?: string;
  }) {
    this.now = args.now;
    this.startedAt = this.now();
    const traceId =
      args.traceId ?? args.parent?.traceId ?? createTraceId(args.createId);
    const spanId = args.spanId ?? createSpanId(args.createId);
    this.spanContext = sampledSpanContext(traceId, spanId);
    this.serviceName = args.serviceName;
    this.name = args.name;
    this.kind = args.kind;
    this.exporter = args.exporter;
    if (args.parent !== undefined) {
      this.parentSpanId = args.parent.spanId;
    }
    this.attributes = { ...(args.attributes ?? {}) };
  }

  setAttribute(key: string, value: string | number | boolean): void {
    if (this.ended) return;
    this.attributes[key] = value;
  }

  addEvent(name: string, attributes?: SpanAttributes): void {
    if (this.ended) return;
    this.events.push({
      name,
      timestamp: new Date(this.now()).toISOString(),
      ...(attributes !== undefined ? { attributes } : {}),
    });
  }

  setStatus(status: SpanStatus): void {
    if (this.ended) return;
    this.status = status;
  }

  end(): void {
    if (this.ended) return;
    this.ended = true;
    const durationMs = this.now() - this.startedAt;
    const record: ExportedSpanRecord = {
      timestamp: new Date(this.now()).toISOString(),
      serviceName: this.serviceName,
      traceId: this.spanContext.traceId,
      spanId: this.spanContext.spanId,
      name: this.name,
      kind: this.kind,
      durationMs,
      status: this.status.code,
      attributes: { ...this.attributes },
      events: [...this.events],
      ...(this.parentSpanId !== undefined
        ? { parentSpanId: this.parentSpanId }
        : {}),
      ...(this.status.message !== undefined
        ? { statusMessage: this.status.message }
        : {}),
    };
    try {
      this.exporter(record);
    } catch {
      /* never throw into caller */
    }
  }
}
