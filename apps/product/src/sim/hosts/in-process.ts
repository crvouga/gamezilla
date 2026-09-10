import {
  openFreshSimServerSql,
  openSimServerSqlFromSeedBytes,
  type SimSql,
} from '@apps/product/sim/fabric/sim-sql';
import type { Clock } from '@pkgs/clock';
import { wallClock } from '@pkgs/clock';
import type { Ports, Runtime } from '@pkgs/sim';
import { virtualTimeRuntime } from '@pkgs/sim';
import type { MultiAppSolidDomSession } from '@pkgs/ui-testing-solid-dom';

import { createSerializedRunFor } from '../setup/sim-wait-pump';
import { loadSolidDomSessionFactory } from './in-process-dom';
import { type ProductExtra, SIM_START_MS } from './ports';

// @io-wall-ok — host factory; wallClock only when skipSeed (product-simulator).

export type InProcessRuntimeOptions = {
  /**
   * Attach a `MultiAppSolidDomSession` (happy-dom) for bun:test scenarios.
   * Default: true when `SIM_WITH_DOM=1` or bun:test, else false (product-simulator).
   */
  readonly withDom?: boolean;
  /** Override start time (product-simulator uses wallClock.now()). */
  readonly startTime?: number;
  /** Inject server SQL. */
  readonly serverSql?: SimSql;
  /**
   * Open + migrate a fresh server DB instead of cloning the sim seed.
   * Default: true outside bun:test (product-simulator).
   */
  readonly skipSeed?: boolean;
};

function defaultWithDom(): boolean {
  if (typeof process === 'undefined') return false;
  return process.env['SIM_WITH_DOM'] === '1' || process.env['BUN_TEST'] === '1';
}

async function openSeededServerSql(clock: Clock): Promise<SimSql> {
  // Lazy: Node seed modules use `__dirname` / node:fs — never load in the web bundle.
  const { ensureSimPostgresMemSeed } = await import(
    '../setup/boot-sim-postgres-mem'
  );
  return openSimServerSqlFromSeedBytes(
    'sim_server',
    clock,
    (await ensureSimPostgresMemSeed()).seedBytes
  );
}

async function openMigratedFreshServerSql(clock: Clock): Promise<SimSql> {
  const serverSql = await openFreshSimServerSql('sim_server', clock);
  const pool = serverSql.pool;
  if (pool !== undefined) {
    // Lazy: migrations run against the node Postgres pool — never load in the
    // web bundle.
    const { migrateSimPostgres } = await import(
      '@apps/server/sim/migrate-sim-postgres'
    );
    await migrateSimPostgres({
      sqlClient: serverSql.sqlClient,
      pool,
      now: clock.now,
    });
  }
  return serverSql;
}

/**
 * In-process product host: virtual time, model network, Solid DOM UI.
 */
export function inProcessRuntime(
  opts?: InProcessRuntimeOptions
): Runtime<Ports & ProductExtra> {
  const withDom = opts?.withDom ?? defaultWithDom();
  const skipSeed = opts?.skipSeed ?? !defaultWithDom();
  const startTime =
    opts?.startTime ?? (skipSeed ? wallClock.now() : SIM_START_MS);
  let runFor: ((durationMs: number) => Promise<void>) | null = null;
  return virtualTimeRuntime({
    startTime,
    waitForIdle: async () => {
      if (runFor === null) {
        throw new Error('inProcessRuntime: waitForIdle before extras wired');
      }
      await runFor(0);
    },
    advanceTime: async (_session, ms) => {
      if (runFor === null) {
        throw new Error('inProcessRuntime: advanceTime before extras wired');
      }
      await runFor(ms);
    },
  }).with(async (session) => {
    const sql =
      opts?.serverSql ??
      (skipSeed
        ? await openMigratedFreshServerSql(session.ports.clock)
        : await openSeededServerSql(session.ports.clock));
    const drainServerHttp: { current: () => Promise<void> } = {
      current: () => Promise.resolve(),
    };
    runFor = createSerializedRunFor(session.scheduler.underlying, {
      after: () => drainServerHttp.current(),
    });
    const domSession: MultiAppSolidDomSession | undefined = withDom
      ? (await loadSolidDomSessionFactory())({
          onActorFocus: () => {
            void runFor?.(1_000).catch(() => undefined);
          },
        })
      : undefined;
    return {
      sql,
      ui: {
        kind: 'solid-dom' as const,
        ...(domSession !== undefined ? { session: domSession } : {}),
        runFor,
      },
      http: { kind: 'in-process' as const },
      drainServerHttp,
    };
  });
}
