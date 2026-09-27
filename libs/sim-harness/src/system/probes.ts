/**
 * Actions whose result is data: they run against live wiring the surface owns
 * and record the outcome in `probes`, where a read can observe it back.
 */

import type { Client } from '@libs/client-app/shell/create-client';
import { defineAction } from '@pkgs/sim';
import type { SimSql } from '../fabric/sim-sql';
import {
  captureSystemSnapshot,
  type SystemSnapshotCtx,
} from '../fabric/system-snapshot';
import type { ProductSim } from './sim';

/** Dump server + client SQL / kv / rooms into `probes.snapshot`. */
export const captureSnapshot = defineAction({
  name: 'captureSnapshot',
  pool: false,
  act: async (s: ProductSim, clientIds: readonly string[]) => {
    s.probes.snapshot = await captureSnapshotOf(s, clientIds);
  },
});

async function captureSnapshotOf(s: ProductSim, clientIds: readonly string[]) {
  const sim = s.sim;
  const clientSqlByAddress = new Map<string, SimSql>();
  const liveClients = new Map<string, Client>();
  for (const id of clientIds) {
    liveClients.set(id, await sim.spawnClient(id));
    const handle = sim.clientSql(id);
    if (handle !== undefined) {
      clientSqlByAddress.set(id, handle);
    }
  }
  const ctx: SystemSnapshotCtx = {
    sim,
    clientIds,
    liveClients,
    clientSqlByAddress,
  };
  return captureSystemSnapshot(ctx);
}
