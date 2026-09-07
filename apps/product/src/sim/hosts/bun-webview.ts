import {
  openSimServerSqlFromSeedBytes,
  type SimSql,
  sharedSqlClient,
} from '@apps/product/sim/fabric/sim-sql';
import type { Ports, Runtime } from '@pkgs/sim';
import { realTimeRuntime } from '@pkgs/sim';

import type { ProductExtra } from './ports';

function isRealMode(): boolean {
  const mode = process.env['SIM_MODE']?.trim();
  return mode === 'real' || mode === 'max';
}

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

async function openRealPostgresSql(): Promise<SimSql> {
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
    reset: () => Promise.resolve(),
    exportBytes: () => Promise.resolve(new Uint8Array()),
    importBytes: () => Promise.resolve(),
  };
}

/**
 * Bun.WebView product host: wall time, localhost HTTP API + web origin.
 * `SIM_MODE=real` uses real Postgres (no partition); otherwise seeded SQL
 * with the model network (partition).
 */
export function bunWebviewRuntime(): Runtime<Ports & ProductExtra> {
  const real = isRealMode();
  return realTimeRuntime({ network: real ? 'none' : 'model' }).with(
    async () => {
      const sql = real
        ? await openRealPostgresSql()
        : await openSeededServerSql();
      const webOrigin =
        process.env['SIM_WEB_ORIGIN'] ?? 'http://127.0.0.1:8081';
      const apiOrigin = process.env['VITE_API_URL'] ?? 'http://127.0.0.1:8787';
      return {
        sql,
        ui: { kind: 'bun-webview' as const, webOrigin },
        http: { kind: 'localhost' as const, origin: apiOrigin },
        drainServerHttp: { current: () => Promise.resolve() },
      };
    }
  );
}
