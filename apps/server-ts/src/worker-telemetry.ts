import {
  type ApiWorkerEnv,
  ConfigurationError,
  readDeploymentProtection,
} from '@libs/app-root-shared-ts/env';
import { SERVER_SERVICE_NAME } from '@libs/observability-shared-ts/service-names';
import type { Timers } from '@pkgs/clock-shared-ts/types';
import { monotonicClock, wallTimers } from '@pkgs/clock-shared-ts/wall';
import type { HttpClient } from '@pkgs/http-client-shared-ts/types';
import { createBusinessEventDelivery } from '@pkgs/observability-root-server-ts/event-delivery';
import { createWorkerTelemetry } from '@pkgs/observability-root-server-ts/worker-worker';
import { deploymentTelemetryEnvironment } from '@pkgs/observability-root-shared-ts/deployment-environment';
import { otlpAuthorization } from '@pkgs/observability-root-shared-ts/otlp-auth';
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
  workerTelemetry = createWorkerTelemetry({
    monotonicNow: monotonicClock.now,
    performanceTimers: wallTimers,
    syncCohort: () => 'server',
    http,
    timers: wallTimers,
    instanceId: createId(),
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
