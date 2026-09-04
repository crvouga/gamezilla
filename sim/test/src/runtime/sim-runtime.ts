import type { Clock } from '@pkgs/clock';
import type { Host, Ports } from '@pkgs/dst';
import { virtualHost } from '@pkgs/dst';
import {
  openSimServerSqlFromSeedBytes,
  type SimSqlHandle,
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

async function openSeededServerSql(clock: Clock): Promise<SimSqlHandle> {
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
export function simHost(): Host<Ports & ProductExtra> {
  let runFor: ((durationMs: number) => Promise<void>) | null = null;
  return virtualHost({
    startTime: SIM_START_MS,
    // Checkpoint settle routes through the serialized drain so it flushes
    // RNTL and cannot nest-drain against ui.runFor / onActorFocus.
    settle: async () => {
      if (runFor === null) {
        throw new Error('simHost: settle before extras wired');
      }
      await runFor(0);
    },
    elapse: async (_session, ms) => {
      if (runFor === null) {
        throw new Error('simHost: elapse before extras wired');
      }
      await runFor(ms);
    },
  }).with(async (session) => {
    const sql = await openSeededServerSql(session.ports.clock);
    runFor = createSerializedRunFor(session.scheduler.underlying);
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
    };
  });
}
