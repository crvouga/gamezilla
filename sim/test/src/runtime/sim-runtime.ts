import type { Clock } from '@pkgs/clock';
import type { Ports, Runtime } from '@pkgs/sim';
import { virtualTimeRuntime } from '@pkgs/sim';
import {
  openSimServerSqlFromSeedBytes,
  type SimSql,
} from '@sim/console/sim/sim-sql';
import { resolveSimSqlBackend } from '@sim/console/sim/sim-sql-backend';

import { ensureSimPgliteSeed } from '../setup/boot-sim-pglite';
import { ensureSimPostgresMemSeed } from '../setup/boot-sim-postgres-mem';
import { createSerializedRunFor } from '../setup/sim-wait-pump';
import { type ProductExtra, SIM_START_MS } from './ports';

type MultiAppRntlSession = ReturnType<
  typeof import('@pkgs/ui-testing')['createMultiAppRntlSession']
>;

function loadRntlSessionFactory(): typeof import('@pkgs/ui-testing')['createMultiAppRntlSession'] {
  return require('@pkgs/ui-testing').createMultiAppRntlSession;
}

async function openSeededServerSql(clock: Clock): Promise<SimSql> {
  const backend = resolveSimSqlBackend();
  const seedBytes =
    backend === 'mem'
      ? (await ensureSimPostgresMemSeed()).seedBytes
      : (await ensureSimPgliteSeed()).seedBytes;
  return openSimServerSqlFromSeedBytes('sim_server', clock, seedBytes);
}

/**
 * In-process product host: virtual time, model network, PGlite/mem SQL, RNTL.
 */
export function simRuntime(): Runtime<Ports & ProductExtra> {
  let runFor: ((durationMs: number) => Promise<void>) | null = null;
  return virtualTimeRuntime({
    startTime: SIM_START_MS,
    // Checkpoint settle routes through the serialized drain so it flushes
    // RNTL and cannot nest-drain against ui.runFor / onActorFocus.
    waitForIdle: async () => {
      if (runFor === null) {
        throw new Error('simRuntime: waitForIdle before extras wired');
      }
      await runFor(0);
    },
    advanceTime: async (_session, ms) => {
      if (runFor === null) {
        throw new Error('simRuntime: advanceTime before extras wired');
      }
      await runFor(ms);
    },
  }).with(async (session) => {
    const sql = await openSeededServerSql(session.ports.clock);
    const drainServerHttp: { current: () => Promise<void> } = {
      current: async () => undefined,
    };
    runFor = createSerializedRunFor(session.scheduler.underlying, {
      after: () => drainServerHttp.current(),
    });
    const rntl: MultiAppRntlSession = loadRntlSessionFactory()({
      onActorFocus: () => {
        void runFor?.(1_000).catch(() => undefined);
      },
    });
    // Do not disconnect `sql` here: `createSim({ serverSql: extra.sql })`
    // owns the handle and `sim.dispose()` closes it. A second PGlite
    // disconnect hangs forever and OOMs the Jest worker.
    return {
      sql,
      ui: { kind: 'rntl' as const, rntl, runFor },
      http: { kind: 'in-process' as const },
      drainServerHttp,
    };
  });
}
