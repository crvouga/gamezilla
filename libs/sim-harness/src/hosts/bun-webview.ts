import type { Ports, Runtime } from '@pkgs/sim';
import { realTimeRuntime } from '@pkgs/sim';
import type { SimComposition } from '../composition';
import {
  openSimServerSqlFromSeedBytes,
  type SimSql,
  sharedSqlClient,
} from '../fabric/sim-sql';
import type { ProductExtra } from './ports';
import { ensureRealStack } from './real-stack';

export type BunWebviewRuntimeOptions = {
  readonly composition: SimComposition;
};

type WebviewMode = 'seeded' | 'real' | 'stack';

function resolveMode(): WebviewMode {
  const mode = process.env['SIM_MODE']?.trim();
  if (mode === 'stack') return 'stack';
  if (mode === 'real' || mode === 'max') return 'real';
  return 'seeded';
}

async function openSeededServerSql(
  composition: SimComposition
): Promise<SimSql> {
  const { wallClock } = await import('@pkgs/clock');
  // Lazy: Node seed modules must not load in the web bundle.
  const { ensureSimPostgresMemSeed } = await import(
    '../setup/boot-sim-postgres-mem'
  );
  return openSimServerSqlFromSeedBytes(
    'sim_server',
    wallClock,
    (await ensureSimPostgresMemSeed(composition)).seedBytes
  );
}

function postgresHandle(pg: {
  readonly sqlClient: Awaited<
    ReturnType<typeof import('../setup/boot-sim-postgres').bootSimPostgres>
  >['sqlClient'];
  stop(): Promise<void>;
}): SimSql {
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

async function openRealPostgresSql(): Promise<SimSql> {
  const { bootSimPostgres } = await import('../setup/boot-sim-postgres');
  await ensureRealStack();
  return postgresHandle(await bootSimPostgres());
}

/** Stack mode owns no infrastructure — it attaches to what is already up. */
async function openStackExtra(): Promise<
  Pick<ProductExtra, 'sql' | 'ui' | 'http'>
> {
  const { readStackAddresses } = await import('../setup/stack-manifest');
  const { bootSimPostgres } = await import('../setup/boot-sim-postgres');
  const addresses = await readStackAddresses();
  process.env['VITE_API_URL'] = addresses.apiOrigin;
  return {
    sql: postgresHandle(await bootSimPostgres(addresses.databaseUrl)),
    ui: { kind: 'bun-webview' as const, webOrigin: addresses.webOrigin },
    http: {
      kind: 'stack' as const,
      origin: addresses.apiOrigin,
      idpOrigin: addresses.idpOrigin,
      accountTag: crypto.randomUUID().slice(0, 8),
    },
  };
}

/**
 * Bun.WebView product host: wall time, localhost HTTP API + web origin.
 *
 * - `SIM_MODE=real` boots sidecars in-process and serves the sim balancer.
 * - `SIM_MODE=stack` attaches to a separately booted localhost stack, so the
 *   system under test is the real fleet behind its own balancer.
 * - otherwise seeded SQL with the model network (partition faults available).
 */
export function bunWebviewRuntime(
  opts: BunWebviewRuntimeOptions
): Runtime<Ports & ProductExtra> {
  const mode = resolveMode();
  return realTimeRuntime({
    network: mode === 'seeded' ? 'model' : 'none',
  }).with(async () => {
    if (mode === 'stack') {
      return {
        ...(await openStackExtra()),
        drainServerHttp: { current: () => Promise.resolve() },
      };
    }
    const sql =
      mode === 'real'
        ? await openRealPostgresSql()
        : await openSeededServerSql(opts.composition);
    const webOrigin = process.env['SIM_WEB_ORIGIN'] ?? 'http://127.0.0.1:8081';
    const apiOrigin = process.env['VITE_API_URL'] ?? 'http://127.0.0.1:8787';
    return {
      sql,
      ui: { kind: 'bun-webview' as const, webOrigin },
      http: { kind: 'localhost' as const, origin: apiOrigin },
      drainServerHttp: { current: () => Promise.resolve() },
    };
  });
}
