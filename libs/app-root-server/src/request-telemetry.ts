import { stampConnectionPlace } from '@libs/app-root-shared/stamp-connection-place';
import {
  ROUTE_GROUPS,
  routeGroupOf,
} from '@libs/observability-shared/route-groups';
import { context, SpanKind, SpanStatusCode } from '@opentelemetry/api';
import { ATTR } from '@pkgs/observability-root-shared/attributes';
import {
  currentCorrelation,
  deserializeTraceContext,
} from '@pkgs/observability-root-shared/correlation';
import { createHttpMetrics } from '@pkgs/observability-root-shared/http-metrics';
import { withIdentityScope } from '@pkgs/observability-root-shared/identity-scope';
import { withSpan } from '@pkgs/observability-root-shared/span';
import type { MiddlewareHandler } from 'hono';
import { routePath } from 'hono/route';

const requestTraceIds = new WeakMap<Request, string>();

/** The trace id recorded for this request, then forgotten. */
export function takeRequestTraceId(request: Request): string | undefined {
  const traceId = requestTraceIds.get(request);
  requestTraceIds.delete(request);
  return traceId;
}

/** One server span per request, including where the connection appeared. */
export function createRequestTelemetryMiddleware(
  now: () => number
): MiddlewareHandler {
  const record = createHttpMetrics(ROUTE_GROUPS);
  return async (c, next) => {
    const started = now();
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
            'libs/app-root-server/src/request-telemetry.ts',
          [ATTR.CODE_FUNCTION_NAME]: 'createRequestTelemetryMiddleware',
        },
        { kind: SpanKind.SERVER }
      );
    try {
      // The scope opens inside the extracted parent: that context replaces the
      // active one, so a scope opened outside it would be lost.
      return await (parent === undefined
        ? withIdentityScope(run)
        : context.with(parent, () => withIdentityScope(run)));
    } finally {
      record({
        method: c.req.method,
        status: c.res.status,
        durationMs: now() - started,
        routeGroup: routeGroupOf(routePath(c)),
      });
    }
  };
}
