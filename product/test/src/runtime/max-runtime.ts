import type { Ports, Runtime } from '@pkgs/sim';
import { realTimeRuntime } from '@pkgs/sim';
import { type SimSql, sharedSqlClient } from '@product/console/sim/sim-sql';

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
 * Wall product host: real Postgres, Playwright, no partition capability.
 */
export function maxRuntime(): Runtime<Ports & ProductExtra> {
  return realTimeRuntime({ network: 'none' }).with(async () => {
    const sql = await postgresServerSql();
    return {
      sql,
      ui: { kind: 'playwright' as const },
      http: { kind: 'loopback' as const },
      drainServerHttp: { current: async () => undefined },
    };
  });
}
