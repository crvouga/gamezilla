import type { Clock } from '@pkgs/clock-shared/types';
import { wallClock } from '@pkgs/clock-shared/wall';
import type { Ports, Runtime } from '@pkgs/harness-shared/runtime-types';
import { virtualTimeRuntime } from '@pkgs/harness-shared/virtual-time-runtime';
import type { MultiAppSolidDomSession } from '@pkgs/ui-testing-solid-dom-client/multi-app-solid-dom-session';
import type { HarnessComposition } from './composition';
import type { HarnessSql } from './sql-types';
import { openFreshHarnessServerSql, openHarnessServerSqlFromSeedBytes } from './sql';
import { compositionMigratePostgres } from './migrate-composition';
import { createSerializedRunFor } from './wait-pump';
import { loadSolidDomSessionFactory } from './in-process-dom';
import { HARNESS_START_MS } from './ports';
import type { ProductExtra } from './ports';

// @io-wall-ok — host factory; wallClock only when skipSeed (product-harness).

export type InProcessRuntimeOptions = {
  /** The features this host's harnesses boot (seed + migrate follow from it). */
  readonly composition: HarnessComposition;
  /**
   * Attach a `MultiAppSolidDomSession` (happy-dom) for bun:test scenarios.
   * Default: true when `HARNESS_WITH_DOM=1` or bun:test, else false (product-harness).
   */
  readonly withDom?: boolean;
  /** Override start time (product-harness uses wallClock.now()). */
  readonly startTime?: number;
  /** Inject server SQL. */
  readonly serverSql?: HarnessSql;
  /**
   * Open + migrate a fresh server DB instead of cloning the harness seed.
   * Default: true outside bun:test (product-harness).
   */
  readonly skipSeed?: boolean;
};

function defaultWithDom(): boolean {
  if (typeof process === 'undefined') return false;
  return (
    process.env['HARNESS_WITH_DOM'] === '1' || process.env['BUN_TEST'] === '1'
  );
}

async function openSeededServerSql(
  composition: HarnessComposition,
  clock: Clock
): Promise<HarnessSql> {
  // Lazy: Node seed modules use `__dirname` / node:fs — never load in the web bundle.
  const { ensureHarnessMockingbirdPostgresSeed } = await import(
    './boot-harness-mockingbird-postgres'
  );
  return openHarnessServerSqlFromSeedBytes(
    'harness_server',
    clock,
    (await ensureHarnessMockingbirdPostgresSeed(composition)).seedBytes
  );
}

async function openMigratedFreshServerSql(
  composition: HarnessComposition,
  clock: Clock
): Promise<HarnessSql> {
  const serverSql = await openFreshHarnessServerSql('harness_server', clock);
  const pool = serverSql.pool;
  if (pool !== undefined) {
    await compositionMigratePostgres(composition)({
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
  opts: InProcessRuntimeOptions
): Runtime<Ports & ProductExtra> {
  const withDom = opts.withDom ?? defaultWithDom();
  const skipSeed = opts.skipSeed ?? !defaultWithDom();
  const startTime =
    opts.startTime ?? (skipSeed ? wallClock.now() : HARNESS_START_MS);
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
      opts.serverSql ??
      (skipSeed
        ? await openMigratedFreshServerSql(
            opts.composition,
            session.ports.clock
          )
        : await openSeededServerSql(opts.composition, session.ports.clock));
    const drainServerHttp: { current: () => Promise<void> } = {
      current: () => Promise.resolve(),
    };
    runFor = createSerializedRunFor(session.scheduler.underlying, {
      after: () => drainServerHttp.current(),
    });
    const domSession: MultiAppSolidDomSession | undefined = withDom
      ? (await loadSolidDomSessionFactory())({
          onActorFocus: () => {
            // Reading another person's screen leaves game time unchanged.
            void runFor?.(0).catch(() => undefined);
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
