import { realTimeRuntime } from '@pkgs/harness-root-shared/real-time-runtime';
import type { Ports, Runtime } from '@pkgs/harness-root-shared/runtime-types';
import type { HarnessComposition } from './composition';
import type { ProductExtra } from './ports';
import { ensureRealStack } from './real-stack';
import { openHarnessServerSqlFromSeedBytes } from './sql';
import type { HarnessSql } from './sql-types';
import { sharedSqlClient } from './sql-types';

export type BunWebviewRuntimeOptions = {
  readonly composition: HarnessComposition;
};

type WebviewMode = 'seeded' | 'real' | 'stack';

function resolveMode(): WebviewMode {
  const mode = process.env['HARNESS_MODE']?.trim();
  if (mode === 'stack') return 'stack';
  if (mode === 'real' || mode === 'max') return 'real';
  return 'seeded';
}

async function openSeededServerSql(
  composition: HarnessComposition
): Promise<HarnessSql> {
  const { wallClock } = await import('@pkgs/clock-shared/wall');
  // Lazy: Node seed modules must not load in the web bundle.
  const { ensureHarnessMockingbirdPostgresSeed } = await import(
    './boot-harness-mockingbird-postgres'
  );
  return openHarnessServerSqlFromSeedBytes(
    'harness_server',
    wallClock,
    (await ensureHarnessMockingbirdPostgresSeed(composition)).seedBytes
  );
}

function postgresHandle(pg: {
  readonly sqlClient: Awaited<
    ReturnType<typeof import('./boot-harness-postgres').bootHarnessPostgres>
  >['sqlClient'];
  stop(): Promise<void>;
}): HarnessSql {
  const shared = sharedSqlClient(pg.sqlClient);
  return {
    get sqlClient() {
      return shared;
    },
    databaseName: 'harness_postgres',
    disconnect: () => pg.stop(),
    reset: () => Promise.resolve(),
    exportBytes: () => Promise.resolve(new Uint8Array()),
    importBytes: () => Promise.resolve(),
  };
}

async function openRealPostgresSql(
  composition: HarnessComposition
): Promise<HarnessSql> {
  const { isolatedPostgres } = await import('./isolated-postgres');
  await ensureRealStack();
  return postgresHandle(await isolatedPostgres(composition));
}

/** Stack mode owns no infrastructure — it attaches to what is already up. */
async function openStackExtra(): Promise<
  Pick<ProductExtra, 'sql' | 'ui' | 'http'>
> {
  const { readStackAddresses } = await import('./stack-manifest');
  const { bootHarnessPostgres } = await import('./boot-harness-postgres');
  const addresses = await readStackAddresses();
  process.env['VITE_API_URL'] = addresses.apiOrigin;
  return {
    sql: postgresHandle(await bootHarnessPostgres(addresses.databaseUrl)),
    ui: { kind: 'bun-webview' as const, webOrigin: addresses.webOrigin },
    http: {
      kind: 'stack' as const,
      origin: addresses.apiOrigin,
      idpOrigins: addresses.idpOrigins,
      accountTag: crypto.randomUUID().slice(0, 8),
    },
  };
}

/**
 * Bun.WebView product host: wall time, localhost HTTP API + web origin.
 *
 * - `HARNESS_MODE=real` boots sidecars in-process and serves the harness balancer.
 * - `HARNESS_MODE=stack` attaches to a separately booted localhost stack, so the
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
        ? await openRealPostgresSql(opts.composition)
        : await openSeededServerSql(opts.composition);
    const webOrigin =
      process.env['HARNESS_WEB_ORIGIN'] ?? 'http://127.0.0.1:8081';
    const apiOrigin = process.env['VITE_API_URL'] ?? 'http://127.0.0.1:8787';
    return {
      sql,
      ui: { kind: 'bun-webview' as const, webOrigin },
      http: { kind: 'localhost' as const, origin: apiOrigin },
      drainServerHttp: { current: () => Promise.resolve() },
    };
  });
}
