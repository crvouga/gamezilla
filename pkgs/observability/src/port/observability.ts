import type {
  Span,
  SpanContext,
  StartSpanOptions,
  ExportedSpanRecord,
} from '../shared/types';

export type {
  SpanContext,
  StartSpanOptions,
  SpanKind,
  SpanStatus,
  Span,
} from '../shared/types';

/**
 * Runtime-agnostic tracing port for fullstack observability.
 *
 * Apps depend on this interface only; adapters live in sibling `impl-*.ts`
 * files (`impl-noop`, `impl-local-file`, future `impl-sentry`). Mirrors the
 * {@link ../object-store/interface.ts ObjectStore} / {@link ../sql-client/interface.ts SqlClient}
 * pattern: one port, swappable backends, conformance tests in `conformance.test.ts`.
 *
 * Spans follow OpenTelemetry-aligned naming ({@link ../shared/semconv.ts semconv})
 * and W3C Trace Context propagation via `traceparent` ({@link ../shared/trace-context.ts}).
 *
 * Contract:
 *   - {@link Observability.startSpan} and {@link Span.end} must never throw into callers.
 *   - {@link Observability.recordException} must never throw.
 *   - Adapters must not log param values, tokens, or other PII in span attributes.
 */
export interface Observability {
  /** Logical service name stamped on every exported span (e.g. `gamezilla-api`). */
  readonly serviceName: string;
  /** Active adapter; `noop` is zero-cost, `local-file` POSTs spans to the dev collector. */
  readonly backend: 'noop' | 'local-file';

  /** Returns the span context bound to the current async scope, if any. */
  activeSpanContext(): SpanContext | undefined;

  /** Runs `fn` with `ctx` installed as the active span context (sync). */
  withSpanContext<T>(ctx: SpanContext, fn: () => T): T;
  /** Runs `fn` with `ctx` installed as the active span context (async). */
  withSpanContextAsync<T>(ctx: SpanContext, fn: () => Promise<T>): Promise<T>;

  /** Starts a span; call {@link Span.end} when the operation completes. */
  startSpan(options: StartSpanOptions): Span;

  /**
   * Records an exception on the active span (or a short-lived child span when none
   * is active). Never throws.
   */
  recordException(error: unknown, attributes?: Record<string, string>): void;

  /** Writes W3C `traceparent` into `carrier` from `context`. */
  inject(context: SpanContext, carrier: Record<string, string>): void;
  /** Parses W3C `traceparent` from `carrier`, or returns `undefined` when absent/invalid. */
  extract(carrier: Record<string, string>): SpanContext | undefined;

  /** Flushes pending exports; no-op for the noop adapter. */
  shutdown(): Promise<void>;
}

/** Adapter hook invoked when a span ends; used by local-file export and tests. */
export type SpanExporter = (record: ExportedSpanRecord) => void;

/**
 * Binds {@link SpanContext} to an async execution scope.
 *
 * Server adapters use {@link ../server/context-storage.ts AsyncLocalStorage};
 * client adapters use an in-memory stack ({@link ./in-memory-context-storage.ts}).
 */
export interface SpanContextStorage {
  active(): SpanContext | undefined;
  runWith<T>(ctx: SpanContext, fn: () => T): T;
  runWithAsync<T>(ctx: SpanContext, fn: () => Promise<T>): Promise<T>;
}
