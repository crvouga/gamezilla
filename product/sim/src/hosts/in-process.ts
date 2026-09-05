import { migrateSimPostgres } from '@apps/server/sim/migrate-sim-postgres';
import type { Clock } from '@pkgs/clock';
import { wallClock } from '@pkgs/clock';
import type { Ports, Runtime } from '@pkgs/sim';
import { virtualTimeRuntime } from '@pkgs/sim';
import {
  openFreshSimServerSql,
  openSimServerSqlFromSeedBytes,
  type SimSql,
} from '@product/sim/fabric/sim-sql';

import { createSerializedRunFor } from '../setup/sim-wait-pump';
import { loadRntlSessionFactory } from './in-process-rntl';
import { type ProductExtra, SIM_START_MS } from './ports';

// @io-wall-ok — host factory; wallClock only when skipSeed (playground).

type MultiAppRntlSession = ReturnType<
  ReturnType<typeof loadRntlSessionFactory>
>;

export type InProcessRuntimeOptions = {
  /**
   * Attach MultiAppRntlSession for bun:test / RNTL tests.
   * Default: true when `SIM_WITH_RNTL=1` or bun:test, else false (playground / Expo).
   */
  readonly withRntl?: boolean;
  /** Override start time (playground uses wallClock.now()). */
  readonly startTime?: number;
  /** Inject server SQL. */
  readonly serverSql?: SimSql;
  /**
   * Open + migrate a fresh server DB instead of cloning the sim seed.
   * Default: true outside bun:test (playground).
   */
  readonly skipSeed?: boolean;
};

function defaultWithRntl(): boolean {
  return (
    process.env['SIM_WITH_RNTL'] === '1' || process.env['BUN_TEST'] === '1'
  );
}

async function openSeededServerSql(clock: Clock): Promise<SimSql> {
  // Lazy: Node seed modules use `__dirname` / node:fs — never load in Expo web.
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
    await migrateSimPostgres({
      sqlClient: serverSql.sqlClient,
      pool,
      now: clock.now,
    });
  }
  return serverSql;
}

/**
 * In-process product host: virtual time, model network, react-tree UI.
 */
export function inProcessRuntime(
  opts?: InProcessRuntimeOptions
): Runtime<Ports & ProductExtra> {
  const withRntl = opts?.withRntl ?? defaultWithRntl();
  const skipSeed = opts?.skipSeed ?? !defaultWithRntl();
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
      opts?.serverSql !== undefined
        ? opts.serverSql
        : skipSeed
          ? await openMigratedFreshServerSql(session.ports.clock)
          : await openSeededServerSql(session.ports.clock);
    const drainServerHttp: { current: () => Promise<void> } = {
      current: async () => undefined,
    };
    runFor = createSerializedRunFor(session.scheduler.underlying, {
      after: () => drainServerHttp.current(),
    });
    const rntl: MultiAppRntlSession | undefined = withRntl
      ? loadRntlSessionFactory()({
          onActorFocus: () => {
            void runFor?.(1_000).catch(() => undefined);
          },
        })
      : undefined;
    return {
      sql,
      ui: {
        kind: 'react-tree' as const,
        ...(rntl !== undefined ? { rntl } : {}),
        runFor,
      },
      http: { kind: 'in-process' as const },
      drainServerHttp,
    };
  });
}
