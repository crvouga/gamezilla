import { metrics } from '@opentelemetry/api';
import { logs } from '@opentelemetry/api-logs';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  BatchLogRecordProcessor,
  LoggerProvider,
} from '@opentelemetry/sdk-logs';
import {
  createAllowListAttributesProcessor,
  MeterProvider,
  PeriodicExportingMetricReader,
} from '@opentelemetry/sdk-metrics';
import { ATTR } from '@pkgs/observability-root-shared/attributes';
import { installStructuredLogBridge } from '@pkgs/observability-root-shared/log';
import { METRIC_DIMENSION_KEYS } from '@pkgs/observability-root-shared/metric-contract';
import { FlushMetricReader } from './flush-metric-reader';
import { GuardedLogExporter } from './guarded-log-exporter';
import type { TelemetryOptions, TelemetryRuntime } from './options';

export function createSignals(
  options: TelemetryOptions,
  worker: boolean
): TelemetryRuntime {
  const resource = resourceFromAttributes({
    [ATTR.SERVICE_NAME]: options.serviceName,
    [ATTR.SERVICE_VERSION]: options.serviceVersion,
    [ATTR.DEPLOYMENT_ENVIRONMENT_NAME]: options.environment,
    [ATTR.APP_BUILD_SHA]: options.buildSha,
  });
  const meter = createMeter(options, resource, worker);
  const logger = createLoggerProvider(options, resource, meter);
  if (options.registerGlobal !== false) {
    if (meter !== undefined) metrics.setGlobalMeterProvider(meter);
    if (logger !== undefined) {
      logs.setGlobalLoggerProvider(logger);
      installStructuredLogBridge();
    }
  }
  return {
    async forceFlush() {
      await Promise.all([logger?.forceFlush(), meter?.forceFlush()]);
    },
    async shutdown() {
      await Promise.all([logger?.shutdown(), meter?.shutdown()]);
    },
  };
}

function createMeter(
  options: TelemetryOptions,
  resource: ReturnType<typeof resourceFromAttributes>,
  worker: boolean
) {
  const metricExporter =
    options.metricExporter ??
    (options.metricsUrl === undefined
      ? undefined
      : new OTLPMetricExporter({
          url: options.metricsUrl,
          ...(options.otlpHeaders === undefined
            ? {}
            : { headers: options.otlpHeaders }),
        }));
  return metricExporter === undefined
    ? undefined
    : new MeterProvider({
        sdkMetricsEnabled: true,
        resource,
        readers: [
          worker
            ? new FlushMetricReader(metricExporter)
            : new PeriodicExportingMetricReader({ exporter: metricExporter }),
        ],
        views: [
          {
            instrumentName: '*',
            aggregationCardinalityLimit: 256,
            attributesProcessors: [
              createAllowListAttributesProcessor([...METRIC_DIMENSION_KEYS]),
            ],
          },
        ],
      });
}

function createLoggerProvider(
  options: TelemetryOptions,
  resource: ReturnType<typeof resourceFromAttributes>,
  meter: MeterProvider | undefined
) {
  const logExporter =
    options.logExporter ??
    (options.logsUrl === undefined
      ? undefined
      : new OTLPLogExporter({
          url: options.logsUrl,
          ...(options.otlpHeaders === undefined
            ? {}
            : { headers: options.otlpHeaders }),
        }));
  return logExporter === undefined
    ? undefined
    : new LoggerProvider({
        resource,
        ...(meter === undefined ? {} : { meterProvider: meter }),
        processors: [
          new BatchLogRecordProcessor({
            ...(meter === undefined ? {} : { selfObsMeterProvider: meter }),
            exporter: new GuardedLogExporter(
              logExporter,
              options.eventContracts ?? []
            ),
            maxQueueSize: 2048,
            maxExportBatchSize: 256,
            exportTimeoutMillis: 5000,
          }),
        ],
        logRecordLimits: {
          attributeCountLimit: 32,
          attributeValueLengthLimit: 512,
        },
      });
}
