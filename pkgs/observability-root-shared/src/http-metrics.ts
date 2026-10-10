import { createMetric } from './metric-contract';

const METHODS = [
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'HEAD',
  'OPTIONS',
  '_OTHER',
] as const;
const DIMENSIONS = {
  'http.request.method': METHODS,
  'app.http.status_class': ['1xx', '2xx', '3xx', '4xx', '5xx'],
};

export function createHttpMetrics() {
  const count = createMetric({
    name: 'http.server.requests',
    description: 'Finished HTTP requests, including unsampled requests',
    type: 'counter',
    unit: '{request}',
    dimensions: DIMENSIONS,
  });
  const duration = createMetric({
    name: 'http.server.request.duration',
    description: 'HTTP request duration',
    type: 'histogram',
    unit: 's',
    dimensions: DIMENSIONS,
  });
  return (method: string, status: number, durationMs: number): void => {
    const attributes = {
      'http.request.method': METHODS.includes(
        method as (typeof METHODS)[number]
      )
        ? method
        : '_OTHER',
      'app.http.status_class': `${Math.min(5, Math.max(1, Math.floor(status / 100)))}xx`,
    };
    count(1, attributes);
    duration(Math.max(0, durationMs) / 1000, attributes);
  };
}
