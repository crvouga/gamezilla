import { TRACEPARENT_HEADER } from '../shared/trace-context';
import type { HttpFetchFn } from '../shared/types';
import { Semconv } from '../shared/semconv';
import type { Observability } from '../port/observability';
import { isObservabilityActive } from '../port/create-observability';

export function instrumentFetch(
  observability: Observability,
  fetchFn: HttpFetchFn = fetch
): HttpFetchFn {
  if (!isObservabilityActive(observability)) return fetchFn;

  return async (
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    let path = url;
    try {
      path = new URL(url).pathname;
    } catch {
      /* keep raw url */
    }

    const span = observability.startSpan({
      name: 'http.client.request',
      kind: 'client',
      attributes: {
        [Semconv.httpRequestMethod]: init?.method ?? 'GET',
        [Semconv.urlPath]: path,
      },
    });

    const headers = new Headers(init?.headers);
    const carrier: Record<string, string> = {};
    observability.inject(span.spanContext, carrier);
    if (carrier[TRACEPARENT_HEADER] !== undefined) {
      headers.set(TRACEPARENT_HEADER, carrier[TRACEPARENT_HEADER]!);
    }

    return observability.withSpanContextAsync(span.spanContext, async () => {
      try {
        const res = await fetchFn(input, { ...init, headers });
        span.setAttribute(Semconv.httpResponseStatusCode, res.status);
        if (res.status >= 400) {
          span.setStatus({ code: 'error', message: `HTTP ${res.status}` });
        } else {
          span.setStatus({ code: 'ok' });
        }
        return res;
      } catch (err: unknown) {
        observability.recordException(err);
        span.setStatus({
          code: 'error',
          message: err instanceof Error ? err.message : String(err),
        });
        throw err;
      } finally {
        span.end();
      }
    });
  };
}
