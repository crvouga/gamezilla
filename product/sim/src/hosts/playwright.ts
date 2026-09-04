import type { Ports, Runtime } from '@pkgs/sim';
import { realTimeRuntime } from '@pkgs/sim';
import { type SimSql, sharedSqlClient } from '@product/sim/fabric/sim-sql';

import type { ProductExtra } from './ports';

async function postgresServerSql(): Promise<SimSql> {
  const { ensureMaxFidelityStack } = await import('../setup/real-mode-stack');
  const { bootSimPostgres } = await import('../setup/boot-sim-postgres');
  await ensureMaxFidelityStack();
  const pg = await bootSimPostgres();
  const shared = sharedSqlClient(pg.sqlClient);
  return {
    get sqlClient() {
      return shared;
    },
    databaseName: 'sim_postgres',
    disconnect: () => pg.stop(),
    reset: async () => undefined,
    exportBytes: async () => new Uint8Array(),
    importBytes: async () => undefined,
  };
}

/**
 * Playwright product host: wall time, real Postgres, localhost HTTP, no partition.
 * Same localhost topology as bun-webview; UI adapter is Playwright.
 */
export function playwrightRuntime(): Runtime<Ports & ProductExtra> {
  return realTimeRuntime({ network: 'none' }).with(async () => {
    const sql = await postgresServerSql();
    const webOrigin =
      process.env['PLAYWRIGHT_BASE_URL'] ?? 'http://127.0.0.1:5173';
    return {
      sql,
      ui: { kind: 'playwright' as const, webOrigin },
      http: {
        kind: 'localhost' as const,
        origin: process.env['EXPO_PUBLIC_API_URL'] ?? 'http://127.0.0.1:8787',
      },
      drainServerHttp: { current: async () => undefined },
    };
  });
}
