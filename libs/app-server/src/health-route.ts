/**
 * Liveness and readiness, in the shape load balancers and monitors expect.
 *
 * - `GET /health` — **liveness**: the process answers. No dependencies, so a
 *   database outage never makes an orchestrator kill healthy instances. (The
 *   Worker also answers `/api/health` before boot, see `apps/server`.)
 * - `GET /health/ready` — **readiness**: can this instance serve a real
 *   request? Probes every hard dependency with a deadline and answers in the
 *   IETF "Health Check Response Format for HTTP APIs" draft
 *   (`application/health+json`): `200` when every check passes, `503` when
 *   any fails. Never cached.
 *
 * A dependency that degrades gracefully (object storage, pubsub, TTS) is not
 * a readiness check: the app still serves requests without it. Those are
 * watched by the per-package `health` probes instead.
 */

import type { ApiHonoEnv } from '@libs/auth-shared/api-hono-env';
import type { Clock, Timers } from '@pkgs/clock-shared/types';
import type { SqlClient } from '@pkgs/sql-client-shared/interface';
import sql from '@pkgs/sql-shared/sql';
import { Hono } from 'hono';

/** Longest a single dependency probe may take before it counts as down. */
export const READINESS_CHECK_TIMEOUT_MS = 3_000;

export type HealthStatus = 'pass' | 'fail';

/** One `checks` entry of the health+json draft. */
export type HealthCheckResult = {
  readonly componentType: 'datastore';
  readonly observedValue: number;
  readonly observedUnit: 'ms';
  readonly status: HealthStatus;
  readonly time: string;
  readonly output?: string;
};

export type ReadinessBody = {
  readonly status: HealthStatus;
  readonly checks: Readonly<Record<string, readonly HealthCheckResult[]>>;
};

export type HealthAppDeps = {
  readonly clock: Clock;
  readonly timers: Timers;
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function withDeadline<T>(
  timers: Timers,
  work: Promise<T>,
  label: string
): Promise<T> {
  let timer: ReturnType<Timers['setTimeout']> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = timers.setTimeout(
      () =>
        reject(
          new Error(
            `${label} timed out after ${String(READINESS_CHECK_TIMEOUT_MS)}ms`
          )
        ),
      READINESS_CHECK_TIMEOUT_MS
    );
  });
  try {
    return await Promise.race([work, deadline]);
  } finally {
    if (timer !== undefined) timers.clearTimeout(timer);
  }
}

/** `SELECT 1` round trip: the database accepts connections and queries. */
export async function probePostgres(
  deps: HealthAppDeps,
  db: SqlClient
): Promise<HealthCheckResult> {
  const started = deps.clock.now();
  let status: HealthStatus = 'pass';
  let output: string | undefined;
  try {
    const rows = await withDeadline(
      deps.timers,
      db.query(sql<{ ok: number }>`SELECT 1 AS ok`),
      'postgres'
    );
    if (Number(rows[0]?.ok) !== 1) {
      status = 'fail';
      output = 'SELECT 1 returned no row';
    }
  } catch (error) {
    status = 'fail';
    output = errorMessage(error);
  }
  const finished = deps.clock.now();
  return {
    componentType: 'datastore',
    observedValue: finished - started,
    observedUnit: 'ms',
    status,
    time: new Date(finished).toISOString(),
    ...(output === undefined ? {} : { output }),
  };
}

export async function readiness(
  deps: HealthAppDeps,
  db: SqlClient
): Promise<ReadinessBody> {
  const postgres = await probePostgres(deps, db);
  const checks = { 'postgres:responseTime': [postgres] };
  const failed = Object.values(checks)
    .flat()
    .some((check) => check.status === 'fail');
  return { status: failed ? 'fail' : 'pass', checks };
}

const HEALTH_HEADERS = {
  'content-type': 'application/health+json',
  'cache-control': 'no-store',
} as const;

export function createHealthApp(deps: HealthAppDeps) {
  return new Hono<ApiHonoEnv>()
    .get('/health', (c) => c.json({ status: 'ok' }, 200))
    .get('/health/ready', async (c) => {
      const body = await readiness(deps, c.get('sqlClient'));
      return c.body(JSON.stringify(body), body.status === 'pass' ? 200 : 503, {
        ...HEALTH_HEADERS,
      });
    });
}
