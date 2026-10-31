import { monotonicClock } from '@pkgs/clock-shared-ts/wall';
// @io-wall-ok — Room server Worker composition root (Durable Object isolate).

import { serviceName } from '@libs/product-identity-shared-ts/technical-names';
import { createRoomServerDurableObject } from '@libs/room-app-server-ts/create-room-server-durable-object';
import type { RoomServerEnv } from '@libs/room-app-shared-ts/room-server-env';
import { wallClock, wallTimers } from '@pkgs/clock-shared-ts/wall';
import { createGlobalHttpClient } from '@pkgs/http-client-shared-ts/global';
import type { WorkerTelemetry } from '@pkgs/observability-root-server-ts/worker-worker';
import { createWorkerTelemetry } from '@pkgs/observability-root-server-ts/worker-worker';
import { deploymentTelemetryEnvironment } from '@pkgs/observability-root-shared-ts/deployment-environment';
import { otlpAuthorization } from '@pkgs/observability-root-shared-ts/otlp-auth';

type RoomWorkerEnv = {
  readonly BUILD_SHA?: string;
  readonly OBSERVABILITY_COLLECTOR_TOKEN?: string;
  readonly OBSERVABILITY_COLLECTOR_URL?: string;
  readonly OBSERVABILITY_LOGS_URL?: string;
  readonly OBSERVABILITY_METRICS_URL?: string;
  readonly OBSERVABILITY_COLLECTOR_USER?: string;
  readonly OBSERVABILITY_ENABLED?: string;
  /** Stamped by libs/infra render-wrangler on deployed Workers only. */
  readonly DEPLOYMENT_ENVIRONMENT?: string;
  /**
   * The env file's `protection` (`production` / `standard`), stamped by
   * libs/infra render-wrangler on deployed Workers; absent (standard) locally.
   */
  readonly DEPLOYMENT_PROTECTION?: string;
};

function isProductionDeployment(env: RoomWorkerEnv): boolean {
  const raw = env.DEPLOYMENT_PROTECTION?.trim() ?? '';
  if (raw === '' || raw === 'standard') return false;
  if (raw === 'production') return true;
  throw new Error(
    `DEPLOYMENT_PROTECTION must be "production" or "standard", got ${JSON.stringify(raw)}`
  );
}

type RoomTelemetryRuntime = Pick<WorkerTelemetry, 'flushWith'>;

let workerTelemetry: RoomTelemetryRuntime | null = null;

function ensureWorkerTelemetry(env: RoomWorkerEnv): RoomTelemetryRuntime {
  if (workerTelemetry !== null) return workerTelemetry;
  if (env.OBSERVABILITY_ENABLED?.trim() === '0') {
    workerTelemetry = { flushWith: () => undefined };
    return workerTelemetry;
  }
  const production = isProductionDeployment(env);
  const collectorUrl = env.OBSERVABILITY_COLLECTOR_URL?.trim();
  if (collectorUrl === undefined || collectorUrl.length === 0) {
    if (production) {
      throw new Error(
        'OBSERVABILITY_COLLECTOR_URL is required in production unless OBSERVABILITY_ENABLED=0'
      );
    }
    workerTelemetry = { flushWith: () => undefined };
    return workerTelemetry;
  }
  const buildSha = env.BUILD_SHA?.trim() || 'development';
  const collectorToken = env.OBSERVABILITY_COLLECTOR_TOKEN?.trim();
  if (
    production &&
    (collectorToken === undefined || collectorToken.length === 0)
  ) {
    throw new Error('OBSERVABILITY_COLLECTOR_TOKEN is required in production');
  }
  const authorization = otlpAuthorization({
    user: env.OBSERVABILITY_COLLECTOR_USER,
    token: collectorToken,
  });
  workerTelemetry = createWorkerTelemetry({
    monotonicNow: monotonicClock.now,
    performanceTimers: wallTimers,
    syncCohort: () => 'server',
    http: createGlobalHttpClient(),
    timers: wallTimers,
    instanceId: crypto.randomUUID(),
    serviceName: serviceName('room-server'),
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

/**
 * A number in [0, 1) nobody can predict from other draws: a room deals hidden
 * hands from it, so it is the platform's cryptographic source, not
 * `Math.random`, whose state a few outputs give away.
 */
function unpredictableRandom(): number {
  const [high, low] = crypto.getRandomValues(new Uint32Array(2));
  return ((high! >>> 5) * 67108864 + (low! >>> 6)) / 9007199254740992;
}

/** The seed is unused by the DO adapter — no random I/O at module load. */
const env: RoomServerEnv = {
  clock: wallClock,
  timers: wallTimers,
  createId: () => crypto.randomUUID(),
  random: unpredictableRandom,
  seed: 1n,
};

export const RoomServerDurableObject = createRoomServerDurableObject(
  env,
  ensureWorkerTelemetry
);
