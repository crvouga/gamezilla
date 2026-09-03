import { defineObservation, observe } from '@pkgs/dst';
import type { SqlClient } from '@pkgs/sql-client/interface';

import { isClosedDatabaseError, isDbOpen } from '../invariants';
import type { SyncSurface } from './system';

export const clientIds = defineObservation({
  name: 'clientIds',
  observe: (s: SyncSurface) => [...s.clients.keys()].sort(),
});

export const pending = defineObservation({
  name: 'pending',
  observe: (s: SyncSurface) => s.pendingEventCount(),
});

export const quiet = defineObservation({
  name: 'quiet',
  observe: (s: SyncSurface) =>
    s.isSchedulerQuiescent() && s.pendingEventCount() === 0,
});

export const caps = defineObservation({
  name: 'caps',
  observe: (s: SyncSurface) => [...s.session.caps] as string[],
});

export const partitioned = defineObservation({
  name: 'partitioned',
  observe: (s: SyncSurface) =>
    s.session.network.partitions().map(([a, b]) => `${a}|${b}`),
});

export const clock = defineObservation({
  name: 'clock',
  observe: (s: SyncSurface) => s.session.ports.clock.now(),
});

export const invariantViolations = defineObservation({
  name: 'invariantViolations',
  observe: async (s: SyncSurface) => {
    try {
      await s.checkInvariants();
      return [] as string[];
    } catch (e) {
      return [e instanceof Error ? e.message : String(e)];
    }
  },
});

/** Pure domain agreement check — never heals or advances time. */
export const converged = defineObservation({
  name: 'converged',
  observe: async (s: SyncSurface) => {
    const clients: { label: string; db: SqlClient }[] = [];
    for (const c of s.clients.values()) {
      try {
        if (await isDbOpen(c.db)) clients.push({ label: c.id, db: c.db });
      } catch (e) {
        if (isClosedDatabaseError(e)) continue;
        throw e;
      }
    }
    try {
      const v = await s.runtime.app.pack.checkAllConverged({
        clients,
        serverDb: s.server.db,
      });
      return v === null;
    } catch (e) {
      if (isClosedDatabaseError(e)) return false;
      throw e;
    }
  },
});

export const healWeight = defineObservation({
  name: 'healWeight',
  *observe() {
    const cut = yield* partitioned;
    return cut.length > 0 ? 1 : 0;
  },
});

export { observe };
