import {
  JsonLogsSerializer,
  JsonMetricsSerializer,
  JsonTraceSerializer,
} from '@opentelemetry/otlp-transformer';
import type { Timers } from '@pkgs/clock-shared/types';
import type { HttpClient } from '@pkgs/http-client-shared/types';
import { HttpOtlpExporter } from './http-otlp-exporter';
import type { TelemetryOptions } from './options';

export type WorkerTelemetryOptions = TelemetryOptions & {
  readonly http?: HttpClient;
  readonly timers?: Timers;
};

/** Only explicitly injected exporters or transports can perform Worker I/O. */
export function workerExporterOptions(
  options: WorkerTelemetryOptions
): TelemetryOptions {
  const needsTransport =
    options.exporter === undefined ||
    (options.logsUrl !== undefined && options.logExporter === undefined) ||
    (options.metricsUrl !== undefined && options.metricExporter === undefined);
  if (!needsTransport) return options;
  const http = options.http;
  const timers = options.timers;
  if (http === undefined || timers === undefined)
    throw new Error('Worker telemetry requires injected HTTP and timers');
  const headers = options.otlpHeaders ?? {};
  if (options.exporter === undefined && options.otlpUrl === undefined)
    throw new Error('Worker telemetry requires an explicit trace endpoint');
  return {
    ...options,
    exporter:
      options.exporter ??
      new HttpOtlpExporter(
        {
          url: options.otlpUrl!,
          headers,
          serializer: JsonTraceSerializer,
          rejected: (response) =>
            Number(response.partialSuccess?.rejectedSpans ?? 0),
        },
        http,
        timers
      ),
    ...(options.logsUrl === undefined || options.logExporter !== undefined
      ? {}
      : {
          logExporter: new HttpOtlpExporter(
            {
              url: options.logsUrl,
              headers,
              serializer: JsonLogsSerializer,
              rejected: (response) =>
                Number(response.partialSuccess?.rejectedLogRecords ?? 0),
            },
            http,
            timers
          ),
        }),
    ...(options.metricsUrl === undefined || options.metricExporter !== undefined
      ? {}
      : {
          metricExporter: new HttpOtlpExporter(
            {
              url: options.metricsUrl,
              headers,
              serializer: JsonMetricsSerializer,
              rejected: (response) =>
                Number(response.partialSuccess?.rejectedDataPoints ?? 0),
            },
            http,
            timers
          ),
        }),
  };
}
