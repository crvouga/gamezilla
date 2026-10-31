import { metrics } from '@opentelemetry/api';
import { logs } from '@opentelemetry/api-logs';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  BatchLogRecordProcessor,
  LoggerProvider,
  type LogRecordExporter,
} from '@opentelemetry/sdk-logs';
import {
  AggregationType,
  createAllowListAttributesProcessor,
  InstrumentType,
  MeterProvider,
  PeriodicExportingMetricReader,
} from '@opentelemetry/sdk-metrics';
import { ATTR } from '@pkgs/observability-root-shared-ts/attributes';
import { installStructuredLogBridge } from '@pkgs/observability-root-shared-ts/log';
import {
  HISTOGRAM_BOUNDARIES,
  installSyncPerformance,
  METRIC_DIMENSION_KEYS,
  SERIES_BUDGET,
  setMetricEnvironment,
} from '@pkgs/observability-root-shared-ts/metric-contract';
import { FlushLogProcessor } from './flush-log-processor';
import { FlushMetricReader } from './flush-metric-reader';
import { GuardedLogExporter } from './guarded-log-exporter';
import type { TelemetryOptions, TelemetryRuntime } from './options';

export function createSignals(
  options: TelemetryOptions,
  worker: boolean
): TelemetryRuntime {
  const resource = resourceFromAttributes({
    ...(options.instanceId === undefined
      ? {}
      : { [ATTR.SERVICE_INSTANCE_ID]: options.instanceId }),
    [ATTR.SERVICE_NAME]: options.serviceName,
    [ATTR.SERVICE_VERSION]: options.serviceVersion,
    [ATTR.DEPLOYMENT_ENVIRONMENT_NAME]: options.environment,
    [ATTR.APP_BUILD_SHA]: options.buildSha,
  });
  const meter = createMeter(options, resource, worker);
  const logger = createLoggerProvider(options, resource, meter, worker);
  if (options.registerGlobal !== false) {
    if (meter !== undefined) {
      metrics.setGlobalMeterProvider(meter);
      setMetricEnvironment(options.environment);
    }
    if (logger !== undefined) {
      logs.setGlobalLoggerProvider(logger);
      installStructuredLogBridge();
    }
  }
  const releasePerformance =
    meter !== undefined &&
    options.registerGlobal !== false &&
    options.monotonicNow !== undefined
      ? installSyncPerformance(options.monotonicNow, {
          ...(options.performanceTimers === undefined
            ? {}
            : { timers: options.performanceTimers }),
          ...(options.syncCohort === undefined
            ? {}
            : { cohort: options.syncCohort }),
        })
      : undefined;
  return {
    async forceFlush() {
      try {
        await logger?.forceFlush();
      } finally {
        await meter?.forceFlush();
      }
    },
    async shutdown() {
      releasePerformance?.();
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
        views: Object.values(InstrumentType).map((instrumentType) => ({
          instrumentType,
          aggregationCardinalityLimit: SERIES_BUDGET,
          attributesProcessors: [
            createAllowListAttributesProcessor([...METRIC_DIMENSION_KEYS]),
          ],
          ...(instrumentType === InstrumentType.HISTOGRAM
            ? {
                aggregation: {
                  type: AggregationType.EXPLICIT_BUCKET_HISTOGRAM,
                  options: {
                    boundaries: [...HISTOGRAM_BOUNDARIES],
                  },
                },
              }
            : {}),
        })),
      });
}

function createLoggerProvider(
  options: TelemetryOptions,
  resource: ReturnType<typeof resourceFromAttributes>,
  meter: MeterProvider | undefined,
  worker: boolean
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
        processors: [logProcessor(options, meter, logExporter, worker)],
        logRecordLimits: {
          attributeCountLimit: 32,
          attributeValueLengthLimit: 512,
        },
      });
}

function logProcessor(
  options: TelemetryOptions,
  meter: MeterProvider | undefined,
  exporter: LogRecordExporter,
  worker: boolean
) {
  const guarded = new GuardedLogExporter(
    exporter,
    options.eventContracts ?? [],
    meter?.getMeter('@pkgs/observability')
  );
  return worker
    ? new FlushLogProcessor(guarded)
    : new BatchLogRecordProcessor({
        ...(meter === undefined ? {} : { selfObsMeterProvider: meter }),
        exporter: guarded,
        maxQueueSize: 2048,
        maxExportBatchSize: 256,
        exportTimeoutMillis: 5000,
      });
}
