import type { SimSystemSnapshot } from '@pkgs/sim-console/shared/sim-system-snapshot';
import type { SimSqlHandle } from '@sim/console/sim/sim-sql';
import {
  captureSystemSnapshot,
  type SystemSnapshotCtx,
} from '@sim/console/sim/system-snapshot';
import type { OpenSimHandle } from './open-sim';
import { productOf } from './open-sim';

export async function captureOpenSimSnapshot(
  run: OpenSimHandle,
  clientIds: readonly string[]
): Promise<SimSystemSnapshot> {
  const sim = productOf(run).sim;
  const clientSqlByAddress = new Map<string, SimSqlHandle>();
  const liveClients = new Map<string, ReturnType<typeof sim.spawnClient>>();
  for (const id of clientIds) {
    liveClients.set(id, sim.spawnClient(id));
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
