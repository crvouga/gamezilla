import type { MiddlewareHandler } from 'hono';
import { isObservabilityActive } from '../port/is-observability-active';
import type { Observability } from '../port/observability';
import { Semconv } from '../shared/semconv';
import { TRACEPARENT_HEADER } from '../shared/trace-context';

export type ObservabilityMiddlewareOptions = {
  readonly match?: (path: string) => boolean;
};

function headersFromRequest(req: Request): Record<string, string> {
  const carrier: Record<string, string> = {};
  const traceparent = req.headers.get(TRACEPARENT_HEADER);
  if (traceparent !== null && traceparent.length > 0) {
    carrier[TRACEPARENT_HEADER] = traceparent;
  }
  return carrier;
}

export function createObservabilityMiddleware(
  observability: Observability,
  options: ObservabilityMiddlewareOptions = {}
): MiddlewareHandler {
  const match = options.match ?? (() => true);

  return async (c, next) => {
    const path = new URL(c.req.url).pathname;
    if (!isObservabilityActive(observability) || !match(path)) {
      return next();
    }

    const url = new URL(c.req.url);
    const extracted = observability.extract(headersFromRequest(c.req.raw));
    const span = observability.startSpan({
      name: 'http.server.request',
      kind: 'server',
      ...(extracted !== undefined ? { parent: extracted } : {}),
      attributes: {
        [Semconv.httpRequestMethod]: c.req.method,
        [Semconv.urlPath]: url.pathname,
      },
    });

    return observability.withSpanContextAsync(span.spanContext, async () => {
      try {
        await next();
        span.setAttribute(Semconv.httpResponseStatusCode, c.res.status);
        if (c.res.status >= 500) {
          span.setStatus({ code: 'error', message: `HTTP ${c.res.status}` });
        } else {
          span.setStatus({ code: 'ok' });
        }
      } catch (err: unknown) {
        observability.recordException(err);
        span.setStatus({
          code: 'error',
          message: err instanceof Error ? err.message : String(err),
        });
        throw err;
      } finally {
        const res = c.res;
        // Never re-wrap `res.body` — cloning a Response stream across concurrent
        // Worker invocations triggers "Cannot perform I/O on behalf of a
        // different request" (ReadableStreamSource / SpanParent). Mutate headers
        // in place; skip WebSocket upgrades (immutable 101 responses).
        const webSocket = (res as Response & { webSocket?: WebSocket })
          .webSocket;
        if (res.status !== 101 && webSocket === undefined) {
          const carrier: Record<string, string> = {};
          observability.inject(span.spanContext, carrier);
          const traceparent = carrier[TRACEPARENT_HEADER];
          if (traceparent !== undefined) {
            try {
              res.headers.set(TRACEPARENT_HEADER, traceparent);
            } catch {
              // Never `c.header()` after finalize: on some runtimes,
              // `Response.body` is undefined and Hono recreates an empty body.
            }
          }
        }
        span.end();
      }
    });
  };
}
