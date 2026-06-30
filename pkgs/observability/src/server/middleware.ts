import type { MiddlewareHandler } from 'hono';
import { TRACEPARENT_HEADER } from '../shared/trace-context';
import { Semconv } from '../shared/semconv';
import { isObservabilityActive } from '../port/create-observability';
import type { Observability } from '../port/observability';

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
        span.setAttribute(
          Semconv.httpResponseStatusCode,
          c.res.status
        );
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
        const headers = new Headers(c.res.headers);
        const carrier: Record<string, string> = {};
        observability.inject(span.spanContext, carrier);
        if (carrier[TRACEPARENT_HEADER] !== undefined) {
          headers.set(TRACEPARENT_HEADER, carrier[TRACEPARENT_HEADER]!);
        }
        c.res = new Response(c.res.body, {
          status: c.res.status,
          statusText: c.res.statusText,
          headers,
        });
        span.end();
      }
    });
  };
}
