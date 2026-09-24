// @io-wall-ok — Room server Worker composition root (Durable Object isolate).

import { createRoomServerDurableObject } from '@libs/room-app/app/create-room-server-durable-object';
import type { RoomServerEnv } from '@libs/room-app/app/room-server-env';
import { wallClock, wallTimers } from '@pkgs/clock';
import {
  createWorkerTelemetry,
  otlpAuthorization,
  type WorkerTelemetry,
} from '@pkgs/observability/worker';

type RoomWorkerEnv = {
  readonly BUILD_SHA?: string;
  readonly OBSERVABILITY_COLLECTOR_TOKEN?: string;
  readonly OBSERVABILITY_COLLECTOR_URL?: string;
  readonly OBSERVABILITY_COLLECTOR_USER?: string;
  readonly OBSERVABILITY_ENABLED?: string;
  readonly SECRETS_ENV?: string;
};

type RoomTelemetryRuntime = Pick<WorkerTelemetry, 'flushWith'>;

let workerTelemetry: RoomTelemetryRuntime | null = null;

function ensureWorkerTelemetry(env: RoomWorkerEnv): RoomTelemetryRuntime {
  if (workerTelemetry !== null) return workerTelemetry;
  if (env.OBSERVABILITY_ENABLED?.trim() === '0') {
    workerTelemetry = { flushWith: () => undefined };
    return workerTelemetry;
  }
  const collectorUrl = env.OBSERVABILITY_COLLECTOR_URL?.trim();
  if (collectorUrl === undefined || collectorUrl.length === 0) {
    if (env.SECRETS_ENV === 'prd') {
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
    env.SECRETS_ENV === 'prd' &&
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
    environment: env.SECRETS_ENV === 'prd' ? 'prod' : 'local',
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

/** Minimal fetch so the Worker script boots; clients reach rooms via API gateway. */
export default {
  async fetch(): Promise<Response> {
    return new Response('room server worker', { status: 200 });
  },
};
