/**
 * Actions whose result is data: they run against live wiring the surface owns
 * and record the outcome in `probes`, where a read can observe it back.
 */

import type { Client } from '@libs/app-client/create-client';
import { defineAction } from '@pkgs/harness-shared/define-action';
import type { ProductHarness } from './harness';
import type { HarnessSql } from './sql-types';
import type { SystemSnapshotCtx } from './system-snapshot';
import { captureSystemSnapshot } from './system-snapshot';

/** Dump server + client SQL / kv / rooms into `probes.snapshot`. */
export const captureSnapshot = defineAction({
  name: 'captureSnapshot',
  pool: false,
  act: async (s: ProductHarness, clientIds: readonly string[]) => {
    s.probes.snapshot = await captureSnapshotOf(s, clientIds);
  },
});

async function captureSnapshotOf(
  s: ProductHarness,
  clientIds: readonly string[]
) {
  const harness = s.harness;
  const clientSqlByAddress = new Map<string, HarnessSql>();
  const liveClients = new Map<string, Client>();
  for (const id of clientIds) {
    liveClients.set(id, await harness.spawnClient(id));
    const handle = harness.clientSql(id);
    if (handle !== undefined) {
      clientSqlByAddress.set(id, handle);
    }
  }
  const ctx: SystemSnapshotCtx = {
    harness,
    clientIds,
    liveClients,
    clientSqlByAddress,
  };
  return captureSystemSnapshot(ctx);
}
