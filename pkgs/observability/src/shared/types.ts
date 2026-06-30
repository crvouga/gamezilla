export type SpanKind = 'internal' | 'server' | 'client';

export type SpanStatus = {
  readonly code: 'ok' | 'error';
  readonly message?: string;
};

export type AttributeValue = string | number | boolean;

export type SpanAttributes = Record<string, AttributeValue>;

export type SpanContext = {
  readonly traceId: string;
  readonly spanId: string;
  readonly traceFlags: number;
};

export type StartSpanOptions = {
  readonly name: string;
  readonly kind?: SpanKind;
  readonly attributes?: SpanAttributes;
  readonly parent?: SpanContext;
};

export type Span = {
  readonly spanContext: SpanContext;
  setAttribute(key: string, value: string | number | boolean): void;
  addEvent(name: string, attributes?: SpanAttributes): void;
  setStatus(status: SpanStatus): void;
  end(): void;
};

export type ExportedSpanRecord = {
  readonly timestamp: string;
  readonly serviceName: string;
  readonly traceId: string;
  readonly spanId: string;
  readonly parentSpanId?: string;
  readonly name: string;
  readonly kind: SpanKind;
  readonly durationMs: number;
  readonly status: SpanStatus['code'];
  readonly statusMessage?: string;
  readonly attributes: SpanAttributes;
  readonly events: ReadonlyArray<{
    readonly name: string;
    readonly timestamp: string;
    readonly attributes?: SpanAttributes;
  }>;
};

export type HttpFetchFn = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;
