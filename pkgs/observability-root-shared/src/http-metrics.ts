import type { MetricContract } from './metric-contract';
import { createMetric } from './metric-contract';

/**
 * Methods are collapsed to the ones that change data; everything else
 * (`HEAD`, `OPTIONS`, …) is `_OTHER`. Together with five status classes this
 * leaves room for eight route groups inside the series budget.
 */
export const HTTP_METHODS = [
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  '_OTHER',
] as const;
export const HTTP_STATUS_CLASSES = ['1xx', '2xx', '3xx', '4xx', '5xx'] as const;

export const HTTP_REQUESTS_METRIC = 'http.server.requests';
export const HTTP_DURATION_METRIC = 'http.server.request.duration';

export type HttpMetricContracts = {
  readonly requests: MetricContract;
  readonly duration: MetricContract;
};

/**
 * What the server emits for every finished request, as contracts. The route
 * group vocabulary is the caller's: it names which kinds of traffic a product
 * wants to tell apart. Objectives and alerts read these same contracts, so
 * the names they query cannot drift from what is emitted.
 */
export function httpMetricContracts(
  routeGroups: readonly string[]
): HttpMetricContracts {
  const dimensions = {
    'http.request.method': HTTP_METHODS,
    'app.http.status_class': HTTP_STATUS_CLASSES,
    'app.http.route_group': routeGroups,
  };
  return {
    requests: {
      name: HTTP_REQUESTS_METRIC,
      description: 'Finished HTTP requests, including unsampled requests',
      type: 'counter',
      unit: '{request}',
      dimensions,
    },
    duration: {
      name: HTTP_DURATION_METRIC,
      description: 'HTTP request duration',
      type: 'histogram',
      unit: 's',
      dimensions,
    },
  };
}

export type HttpRequestFinished<Group extends string> = {
  readonly method: string;
  readonly status: number;
  readonly durationMs: number;
  readonly routeGroup: Group;
};

export function createHttpMetrics<Group extends string>(
  routeGroups: readonly Group[]
): (finished: HttpRequestFinished<Group>) => void {
  const contracts = httpMetricContracts(routeGroups);
  const count = createMetric(contracts.requests);
  const duration = createMetric(contracts.duration);
  return (finished) => {
    const attributes = {
      'http.request.method': (HTTP_METHODS as readonly string[]).includes(
        finished.method
      )
        ? finished.method
        : '_OTHER',
      'app.http.status_class': `${Math.min(5, Math.max(1, Math.floor(finished.status / 100)))}xx`,
      'app.http.route_group': finished.routeGroup,
    };
    count(1, attributes);
    duration(Math.max(0, finished.durationMs) / 1000, attributes);
  };
}
