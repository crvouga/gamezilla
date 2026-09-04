import type { Ports, Runtime } from '@pkgs/sim';
import { realTimeRuntime } from '@pkgs/sim';
import {
  openSimServerSqlFromSeedBytes,
  type SimSql,
} from '@product/sim/fabric/sim-sql';
import { resolveSimSqlBackend } from '@product/sim/fabric/sim-sql-backend';

import { ensureSimPgliteSeed } from '../setup/boot-sim-pglite';
import { ensureSimPostgresMemSeed } from '../setup/boot-sim-postgres-mem';
import type { ProductExtra } from './ports';

async function openSeededServerSql(): Promise<SimSql> {
  const { wallClock } = await import('@pkgs/clock');
  const backend = resolveSimSqlBackend();
  const seedBytes =
    backend === 'mem'
      ? (await ensureSimPostgresMemSeed()).seedBytes
      : (await ensureSimPgliteSeed()).seedBytes;
  return openSimServerSqlFromSeedBytes(
    'sim_server',
    wallClock,
    seedBytes
  );
}

/**
 * Bun.WebView product host: wall time, model network (partition), seeded SQL,
 * localhost HTTP API + web origin. Actors launch as Bun.WebView documents.
 */
export function bunWebviewRuntime(): Runtime<Ports & ProductExtra> {
  return realTimeRuntime({ network: 'model' }).with(async () => {
    const sql = await openSeededServerSql();
    const webOrigin =
      process.env['SIM_WEB_ORIGIN'] ??
      process.env['PLAYWRIGHT_BASE_URL'] ??
      'http://127.0.0.1:5173';
    const apiOrigin =
      process.env['EXPO_PUBLIC_API_URL'] ?? 'http://127.0.0.1:8787';
    return {
      sql,
      ui: { kind: 'bun-webview' as const, webOrigin },
      http: { kind: 'localhost' as const, origin: apiOrigin },
      drainServerHttp: { current: async () => undefined },
    };
  });
}
