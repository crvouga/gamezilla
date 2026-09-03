import type { Host, Ports } from '@pkgs/dst';
import { wallHost } from '@pkgs/dst';
import { type SimSqlHandle, sharedSqlClient } from '@sim/console/sim/sim-sql';

import type { ProductExtra } from './ports';

async function postgresServerSql(): Promise<SimSqlHandle> {
  const { ensureMaxFidelityStack } = await import(
    '../setup/max-fidelity-stack'
  );
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
export function maxHost(): Host<Ports & ProductExtra> {
  return wallHost({ network: 'none' }).with(async () => {
    const sql = await postgresServerSql();
    return {
      sql,
      ui: { kind: 'playwright' as const },
      http: { kind: 'loopback' as const },
    };
  });
}
