import { DST_FAULTS, RELIABLE_FAULTS, sampleFaultOptions } from './faults';
import { isDbOpen } from './invariants';
import type { World } from './world-api';

async function restartClientWithRetry(world: World, id: string): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await world.node(id).restart({ preserveLocalDb: true });
      return;
    } catch (error) {
      if (error instanceof Error && error.message === 'sim: fail next open') {
        continue;
      }
      throw error;
    }
  }
}

/** Add N clients and optionally enable DST / sampled network faults. */
export async function bootClients(args: {
  readonly world: World;
  readonly clientCount: number;
  readonly sampleFaults: boolean;
  /** Mild fixed reorder/loss faults (ignored when sampleFaults is true). */
  readonly dstFaults?: boolean;
}): Promise<string[]> {
  const ids: string[] = [];
  for (let i = 0; i < args.clientCount; i += 1) {
    const id = `c${i}`;
    await args.world.addClient({ id, actorId: id });
    ids.push(id);
  }
  if (args.sampleFaults) {
    const sampled = sampleFaultOptions(args.world.rng.fork('faults'));
    args.world.network.setDefaultFaults(sampled);
  } else if (args.dstFaults === true) {
    args.world.network.setDefaultFaults(DST_FAULTS);
  }
  await args.world.runFor(200);
  return ids;
}

/** Heal partitions, clear holds/faults, bring clients online, assert converge. */
export async function settleWorld(args: {
  readonly world: World;
  readonly ids: readonly string[];
}): Promise<void> {
  args.world.clearFailNextOpen();
  args.world.clearStoragePressure();
  args.world.clearBoundaryFaults();
  for (const id of args.ids) {
    args.world.net(id, 'all').set('ok');
  }
  args.world.network.setDefaultFaults(RELIABLE_FAULTS);
  for (const id of args.ids) {
    const client = args.world.clients.get(id);
    const needsRestart = client === undefined || !(await isDbOpen(client.db));
    if (needsRestart) {
      await restartClientWithRetry(args.world, id);
    }
    args.world.clients.get(id)?.online(true);
    args.world.clients.get(id)?.foreground(true);
  }
  await args.world.assertConverged();
}
