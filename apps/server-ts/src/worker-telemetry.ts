import {
  type ApiWorkerEnv,
  ConfigurationError,
  type MetricAggregateNamespace,
  readDeploymentProtection,
} from '@libs/app-root-shared-ts/env';
import { SERVER_SERVICE_NAME } from '@libs/observability-shared-ts/service-names';
import { serviceName } from '@libs/product-identity-shared-ts/technical-names';
import type { Clock, Timers } from '@pkgs/clock-shared-ts/types';
import {
  monotonicClock,
  wallClock,
  wallTimers,
} from '@pkgs/clock-shared-ts/wall';
import type { HttpClient } from '@pkgs/http-client-shared-ts/types';
import {
  createMetricAggregateDurableObject,
  createMetricHandoffExporter,
  METRIC_AGGREGATE_INSTANCE_ID,
  metricBackendSend,
} from '@pkgs/observability-aggregate-server-ts/metric-aggregate-durable-object';
import { createBusinessEventDelivery } from '@pkgs/observability-root-server-ts/event-delivery';
import { createWorkerTelemetry } from '@pkgs/observability-root-server-ts/worker-worker';
import { deploymentTelemetryEnvironment } from '@pkgs/observability-root-shared-ts/deployment-environment';
import {
  METRIC_DIMENSION_KEYS,
  SERIES_BUDGET,
} from '@pkgs/observability-root-shared-ts/metric-contract';
import { otlpAuthorization } from '@pkgs/observability-root-shared-ts/otlp-auth';
// The deployment's single metrics writer: the Durable Object every Worker
// isolate hands its counts to, and the exporter an isolate uses to reach it.
// The entry roots that own wall time and the network supply the ports.

export const ROOM_SERVICE_NAME = serviceName('room-server');

/** The label the SDK puts on what it counted beyond an instrument's budget. */
const OVERFLOW_LABEL = 'otel.metric.overflow';

export type MetricAggregateEnv = {
  readonly OBSERVABILITY_COLLECTOR_TOKEN?: string;
  readonly OBSERVABILITY_COLLECTOR_USER?: string;
  readonly OBSERVABILITY_ENABLED?: string;
  readonly OBSERVABILITY_METRICS_URL?: string;
  readonly DEPLOYMENT_ENVIRONMENT?: string;
  readonly METRIC_AGGREGATE?: MetricAggregateNamespace;
};

function metricsUrlOf(env: MetricAggregateEnv): string | undefined {
  if (env.OBSERVABILITY_ENABLED?.trim() === '0') return undefined;
  const url = env.OBSERVABILITY_METRICS_URL?.trim();
  return url === undefined || url.length === 0 ? undefined : url;
}

export type MetricWriterPorts = {
  readonly clock: Clock;
  readonly timers: Timers;
};

export function createMetricAggregate(
  ports: MetricWriterPorts & { readonly http: HttpClient }
) {
  return createMetricAggregateDurableObject<MetricAggregateEnv>({
    clock: ports.clock,
    settings(env) {
      const url = metricsUrlOf(env);
      if (url === undefined) return null;
      const authorization = otlpAuthorization({
        user: env.OBSERVABILITY_COLLECTOR_USER,
        token: env.OBSERVABILITY_COLLECTOR_TOKEN?.trim(),
      });
      return {
        services: [SERVER_SERVICE_NAME, ROOM_SERVICE_NAME],
        attributeKeys: [...METRIC_DIMENSION_KEYS, OVERFLOW_LABEL],
        seriesPerMetric: SERIES_BUDGET,
        identity: {
          instanceId: METRIC_AGGREGATE_INSTANCE_ID,
          environment: deploymentTelemetryEnvironment(
            env.DEPLOYMENT_ENVIRONMENT
          ),
        },
        send: metricBackendSend(
          {
            url,
            headers:
              authorization === undefined
                ? {}
                : { Authorization: authorization },
          },
          ports.http,
          ports.timers
        ),
      };
    },
  });
}

/**
 * How an isolate reports metrics where the aggregate is bound: it hands over
 * what it counted and stores no series of its own. Without the binding (the
 * local API, a long-lived process that is one writer already) there is no
 * exporter here and the runtime exports directly.
 */
export function aggregateMetricExporter(
  env: MetricAggregateEnv,
  writer: { readonly id: string; readonly service: string },
  ports: MetricWriterPorts
) {
  const namespace = env.METRIC_AGGREGATE;
  if (namespace === undefined || metricsUrlOf(env) === undefined) return {};
  return {
    metricExporter: createMetricHandoffExporter(namespace, ports.timers, {
      writer: writer.id,
      service: writer.service,
      clock: ports.clock,
      onLost: (lost) =>
        console.warn('metric increments not added to the totals', lost),
    }),
  };
}

export type WorkerTelemetryRuntime = {
  readonly forceFlush: () => Promise<void>;
  readonly flushWith: (waitUntil: (promise: Promise<unknown>) => void) => void;
};
let workerTelemetry: WorkerTelemetryRuntime | null = null;

export function businessEventDeliveryOptions(
  env: ApiWorkerEnv,
  http: HttpClient,
  timers: Timers
) {
  if (env.OBSERVABILITY_ENABLED?.trim() === '0') return {};
  const authorization = otlpAuthorization({
    user: env.OBSERVABILITY_COLLECTOR_USER,
    token: env.OBSERVABILITY_COLLECTOR_TOKEN,
  });
  const logsUrl = env.OBSERVABILITY_LOGS_URL?.trim();
  const deliverBusinessEvent = createBusinessEventDelivery(
    {
      serviceName: SERVER_SERVICE_NAME,
      serviceVersion: env.BUILD_SHA?.trim() || 'development',
      buildSha: env.BUILD_SHA?.trim() || 'development',
      environment: deploymentTelemetryEnvironment(env.DEPLOYMENT_ENVIRONMENT),
      ...(logsUrl ? { logsUrl } : {}),
      ...(authorization === undefined
        ? {}
        : { otlpHeaders: { Authorization: authorization } }),
    },
    http,
    timers
  );
  return deliverBusinessEvent === undefined ? {} : { deliverBusinessEvent };
}

export function ensureWorkerTelemetry(
  env: ApiWorkerEnv,
  createId: () => string,
  http: HttpClient
): WorkerTelemetryRuntime {
  if (workerTelemetry !== null) return workerTelemetry;
  if (env.OBSERVABILITY_ENABLED?.trim() === '0') {
    workerTelemetry = {
      flushWith: () => undefined,
      forceFlush: async () => undefined,
    };
    return workerTelemetry;
  }
  const production = readDeploymentProtection(env) === 'production';
  const collectorUrl = env.OBSERVABILITY_COLLECTOR_URL?.trim();
  if (collectorUrl === undefined || collectorUrl.length === 0) {
    if (production) {
      throw new ConfigurationError(
        'OBSERVABILITY_COLLECTOR_URL is required in production unless OBSERVABILITY_ENABLED=0'
      );
    }
    workerTelemetry = {
      flushWith: () => undefined,
      forceFlush: async () => undefined,
    };
    return workerTelemetry;
  }
  const buildSha = env.BUILD_SHA?.trim() || 'development';
  const collectorToken = env.OBSERVABILITY_COLLECTOR_TOKEN?.trim();
  if (
    production &&
    (collectorToken === undefined || collectorToken.length === 0)
  ) {
    throw new ConfigurationError(
      'OBSERVABILITY_COLLECTOR_TOKEN is required in production'
    );
  }
  const authorization = otlpAuthorization({
    user: env.OBSERVABILITY_COLLECTOR_USER,
    token: collectorToken,
  });
  // Spans and logs carry this isolate's identity. Its metrics do not: they
  // are handed to the deployment's one metrics writer.
  const instanceId = createId();
  workerTelemetry = createWorkerTelemetry({
    monotonicNow: monotonicClock.now,
    performanceTimers: wallTimers,
    syncCohort: () => 'server',
    http,
    timers: wallTimers,
    instanceId,
    ...aggregateMetricExporter(
      env,
      { id: instanceId, service: SERVER_SERVICE_NAME },
      { clock: wallClock, timers: wallTimers }
    ),
    serviceName: SERVER_SERVICE_NAME,
    serviceVersion: buildSha,
    environment: deploymentTelemetryEnvironment(env.DEPLOYMENT_ENVIRONMENT),
    buildSha,
    otlpUrl: collectorUrl,
    ...(env.OBSERVABILITY_LOGS_URL?.trim()
      ? { logsUrl: env.OBSERVABILITY_LOGS_URL.trim() }
      : {}),
    ...(env.OBSERVABILITY_METRICS_URL?.trim()
      ? { metricsUrl: env.OBSERVABILITY_METRICS_URL.trim() }
      : {}),
    ...(authorization === undefined
      ? {}
      : { otlpHeaders: { Authorization: authorization } }),
  });
  return workerTelemetry;
}

export function telemetryEndpointOptions(env: ApiWorkerEnv) {
  return {
    observabilityCollectorUrl: env.OBSERVABILITY_COLLECTOR_URL?.trim() || null,
    observabilityLogsUrl: env.OBSERVABILITY_LOGS_URL?.trim() || null,
    observabilityMetricsUrl: env.OBSERVABILITY_METRICS_URL?.trim() || null,
    observabilityEnvironment: deploymentTelemetryEnvironment(
      env.DEPLOYMENT_ENVIRONMENT
    ),
  };
}
