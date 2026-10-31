import type { Attributes as OtelAttributes } from '@opentelemetry/api';
import {
  context,
  type Span,
  type SpanOptions,
  SpanStatusCode,
  trace,
} from '@opentelemetry/api';
import type { Attributes } from './attributes';
import {
  beginSyncMeasurement,
  type SyncPerformanceStage,
} from './metric-contract';
import { ReproducibleError } from './reproducible-error';

const TRACER_NAME = '@pkgs/observability';

export type DisposableSpan = Span & Disposable;
export type StartSpanOptions = Omit<SpanOptions, 'attributes'>;

/**
 * Starts a leaf span and guarantees lifetime closure with `using`.
 * JavaScript disposal receives no thrown exception, so use {@link withSpan}
 * whenever the scope must record failures or remain active across awaits.
 */
export function startSpan(
  name: string,
  attributes?: Attributes,
  options?: StartSpanOptions
): DisposableSpan {
  const span = trace.getTracer(TRACER_NAME).startSpan(name, {
    ...options,
    ...(attributes === undefined
      ? {}
      : { attributes: attributes as OtelAttributes }),
  });
  return Object.assign(span, {
    [Symbol.dispose]() {
      span.end();
    },
  });
}

export async function withSpan<T>(
  name: string,
  fn: (span: Span) => T | Promise<T>,
  attributes?: Attributes,
  options?: StartSpanOptions
): Promise<T> {
  const tracer = trace.getTracer(TRACER_NAME);
  return tracer.startActiveSpan(
    name,
    {
      ...options,
      ...(attributes === undefined
        ? {}
        : { attributes: attributes as OtelAttributes }),
    },
    async (span) => {
      try {
        return await fn(span);
      } catch (error) {
        recordException(span, error);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : String(error),
        });
        throw error;
      } finally {
        span.end();
      }
    }
  );
}

export type AsyncFlushScope = DisposableSpan & AsyncDisposable;

export function startFlushScope(
  name: string,
  forceFlush: () => Promise<void>,
  attributes?: Attributes,
  options?: StartSpanOptions
): AsyncFlushScope {
  const span = startSpan(name, attributes, options);
  return Object.assign(span, {
    async [Symbol.asyncDispose]() {
      span.end();
      await forceFlush();
    },
  });
}

export function activeSpan(): Span | undefined {
  return trace.getSpan(context.active());
}

/** Preserve bounded replay details without changing ordinary exception recording. */
export function recordException(span: Span, error: unknown): void {
  span.recordException(
    error instanceof Error ? error : new Error(String(error))
  );
  if (error instanceof ReproducibleError)
    span.setAttributes(error.diagnostic as OtelAttributes);
}

/** Metrics remain independent of trace sampling. No clock means no latency claim. */
export async function observeSync<T>(
  stage: SyncPerformanceStage,
  run: () => T | Promise<T>,
  attributes?: Attributes,
  success: (result: T) => boolean = () => true
): Promise<T> {
  const finish = beginSyncMeasurement(stage);
  try {
    const result = await withSpan(`sync.work.${stage}`, run, attributes);
    finish(success(result));
    return result;
  } catch (error) {
    finish(false);
    throw error;
  }
}

export function observeSyncNow<T>(
  stage: SyncPerformanceStage,
  run: () => T,
  attributes?: Attributes
): T {
  const finish = beginSyncMeasurement(stage);
  using span = startSpan(`sync.work.${stage}`, attributes);
  try {
    const result = context.with(trace.setSpan(context.active(), span), run);
    finish(true);
    return result;
  } catch (error) {
    finish(false);
    recordException(span, error);
    span.setStatus({ code: SpanStatusCode.ERROR });
    throw error;
  }
}
