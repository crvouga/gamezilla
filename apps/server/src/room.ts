// @io-wall-ok — Room server Worker composition root (Durable Object isolate).

import { createRoomServerDurableObject } from '@libs/room-app-server/create-room-server-durable-object';
import type { RoomServerEnv } from '@libs/room-app-shared/room-server-env';
import { wallClock, wallTimers } from '@pkgs/clock-shared/wall';
import type { WorkerTelemetry } from '@pkgs/observability-server/worker-worker';
import { createWorkerTelemetry } from '@pkgs/observability-server/worker-worker';
import { deploymentTelemetryEnvironment } from '@pkgs/observability-shared/deployment-environment';
import { otlpAuthorization } from '@pkgs/observability-shared/otlp-auth';

type RoomWorkerEnv = {
  readonly BUILD_SHA?: string;
  readonly OBSERVABILITY_COLLECTOR_TOKEN?: string;
  readonly OBSERVABILITY_COLLECTOR_URL?: string;
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
    serviceName: 'gamezilla-room-server',
    serviceVersion: buildSha,
    environment: deploymentTelemetryEnvironment(env.DEPLOYMENT_ENVIRONMENT),
    buildSha,
    otlpUrl: collectorUrl,
    ...(authorization === undefined
      ? {}
      : { otlpHeaders: { Authorization: authorization } }),
  });
  return workerTelemetry;
}

/** DO adapter only uses clock/createId; seed is unused — no random I/O at module load. */
const env: RoomServerEnv = {
  clock: wallClock,
  timers: wallTimers,
  createId: () => crypto.randomUUID(),
  random: () => Math.random(),
  seed: 1n,
};

export const RoomServerDurableObject = createRoomServerDurableObject(
  env,
  ensureWorkerTelemetry
);
