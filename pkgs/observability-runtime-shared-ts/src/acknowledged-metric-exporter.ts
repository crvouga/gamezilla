import { JsonMetricsSerializer } from '@opentelemetry/otlp-transformer';
import type { Timers } from '@pkgs/clock-shared-ts/types';
import type { HttpClient } from '@pkgs/http-client-shared-ts/types';
import { HttpOtlpExporter } from './http-otlp-exporter';

/** Browser metrics use the same bounded, injected acknowledgement transport. */
export function acknowledgedMetricExporter(
  url: string,
  http: HttpClient,
  timers: Timers
) {
  return new HttpOtlpExporter(
    {
      url,
      headers: {},
      serializer: JsonMetricsSerializer,
      rejected: (response) =>
        Number(response.partialSuccess?.rejectedDataPoints ?? 0),
    },
    http,
    timers
  );
}
