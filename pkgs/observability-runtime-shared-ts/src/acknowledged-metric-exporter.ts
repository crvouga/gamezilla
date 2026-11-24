import { JsonMetricsSerializer } from '@opentelemetry/otlp-transformer';
import type { Timers } from '@pkgs/clock-shared-ts/types';
import type { HttpClient } from '@pkgs/http-client-shared-ts/types';
import { HttpOtlpExporter } from './http-otlp-exporter';

/**
 * Metrics over the bounded, injected acknowledgement transport: the browser,
 * and the aggregate that is a deployment's single metrics writer.
 */
export function acknowledgedMetricExporter(
  url: string,
  http: HttpClient,
  timers: Timers,
  headers: Readonly<Record<string, string>> = {}
) {
  return new HttpOtlpExporter(
    {
      url,
      headers,
      serializer: JsonMetricsSerializer,
      rejected: (response) =>
        Number(response.partialSuccess?.rejectedDataPoints ?? 0),
    },
    http,
    timers
  );
}
