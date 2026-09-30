import {
  ATTR,
  context,
  currentCorrelation,
  deserializeTraceContext,
  SpanKind,
  SpanStatusCode,
  withSpan,
} from '@pkgs/observability/core';
import type { MiddlewareHandler } from 'hono';
import { routePath } from 'hono/route';
import { stampConnectionPlace } from './stamp-connection-place';

const requestTraceIds = new WeakMap<Request, string>();

/** The trace id recorded for this request, then forgotten. */
export function takeRequestTraceId(request: Request): string | undefined {
  const traceId = requestTraceIds.get(request);
  requestTraceIds.delete(request);
  return traceId;
}

/** One server span per request, including where the connection appeared. */
export function createRequestTelemetryMiddleware(): MiddlewareHandler {
  return async (c, next) => {
    const traceparent = c.req.header('traceparent');
    const parent =
      traceparent === undefined
        ? undefined
        : deserializeTraceContext(traceparent);
    const run = () =>
      withSpan(
        'http.server.request',
        async (span) => {
          stampConnectionPlace(span, c.req.raw);
          requestTraceIds.set(c.req.raw, span.spanContext().traceId);
          await next();
          if (c.res.status >= 500) {
            span.setStatus({ code: SpanStatusCode.ERROR });
          }
          span.setAttribute(ATTR.HTTP_ROUTE, routePath(c));
          span.setAttribute(ATTR.HTTP_RESPONSE_STATUS_CODE, c.res.status);
          const outgoing = currentCorrelation().traceparent;
          if (outgoing !== undefined) c.header('traceparent', outgoing);
          requestTraceIds.delete(c.req.raw);
        },
        {
          [ATTR.HTTP_REQUEST_METHOD]: c.req.method,
          [ATTR.CODE_FILE_PATH]:
            'libs/server-app/src/observability/request-telemetry.ts',
          [ATTR.CODE_FUNCTION_NAME]: 'createRequestTelemetryMiddleware',
        },
        { kind: SpanKind.SERVER }
      );
    return parent === undefined ? run() : context.with(parent, run);
  };
}
