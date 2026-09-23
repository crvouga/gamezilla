import {
  openSimServerSqlFromSeedBytes,
  type SimSql,
} from '@apps/product/sim/fabric/sim-sql';
import { globalHttpFetch } from '@pkgs/http-client';
import type { Ports, Runtime } from '@pkgs/sim';
import { realTimeRuntime } from '@pkgs/sim';

import type { ProductExtra, ProductHostName } from './ports';

async function openSeededServerSql(): Promise<SimSql> {
  const { wallClock } = await import('@pkgs/clock');
  // Lazy: Node seed modules must not load in the web bundle.
  const { ensureSimPostgresMemSeed } = await import(
    '../setup/boot-sim-postgres-mem'
  );
  return openSimServerSqlFromSeedBytes(
    'sim_server',
    wallClock,
    (await ensureSimPostgresMemSeed()).seedBytes
  );
}

function requiredStackEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (value === undefined || value === '') {
    throw new Error(
      `localhost profile drives the full stack booted by \`bun e2e\` (${name} unset)`
    );
  }
  return value;
}

/**
 * `localhost:mocked`: sim Hono + seeded postgres-mem behind a loopback
 * listener; the model network keeps crash / partition.
 */
function mockedRuntime(): Runtime<Ports & ProductExtra> {
  return realTimeRuntime({ network: 'model' }).with(async () => ({
    sql: await openSeededServerSql(),
    ui: {
      kind: 'bun-webview' as const,
      webOrigin: process.env['SIM_WEB_ORIGIN'] ?? 'http://127.0.0.1:8081',
    },
    http: {
      kind: 'localhost' as const,
      origin: process.env['SIM_API_ORIGIN'] ?? 'http://localhost:8787',
    },
    drainServerHttp: { current: () => Promise.resolve() },
  }));
}

/**
 * `localhost`: the full system — real API + room Workers, built client,
 * embedded Postgres / MinIO / EMQX — booted by `bun e2e`. Actors are
 * Bun.WebViews on the web origin; the harness only resets the stack's
 * database per run. No network model, so no partition capability.
 */
function fullStackRuntime(): Runtime<Ports & ProductExtra> {
  return realTimeRuntime({ network: 'none' }).with(async () => {
    const { openStackServerSql } = await import(
      '../setup/open-stack-server-sql'
    );
    const sql = openStackServerSql(requiredStackEnv('SIM_STACK_DATABASE_URL'));
    await sql.reset();
    return {
      sql,
      ui: {
        kind: 'bun-webview' as const,
        webOrigin: requiredStackEnv('SIM_WEB_ORIGIN'),
      },
      http: {
        kind: 'full-stack' as const,
        origin: requiredStackEnv('SIM_API_ORIGIN'),
        fetch: globalHttpFetch,
      },
      drainServerHttp: { current: () => Promise.resolve() },
    };
  });
}

/** Bun.WebView product hosts: wall time against a loopback web origin. */
export function localhostRuntime(
  profile: Exclude<ProductHostName, 'in-process'>
): Runtime<Ports & ProductExtra> {
  return profile === 'localhost' ? fullStackRuntime() : mockedRuntime();
}
