import { DST_FAULTS, RELIABLE_FAULTS, sampleFaultOptions } from './faults';
import { isDbOpen } from './invariants';
import { restartClientWithRetry } from './scenario/replay-step';
import type { SyncSurface } from './scenario/system';

/** Add N clients and optionally enable DST / sampled network faults. */
export async function bootClients(args: {
  readonly world: SyncSurface;
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
    args.world.kit.network.setDefaultFaults(sampled);
  } else if (args.dstFaults === true) {
    args.world.kit.network.setDefaultFaults(DST_FAULTS);
  }
  await args.world.advance(200);
  return ids;
}

function settleClientIds(
  world: SyncSurface,
  bootIds: readonly string[]
): string[] {
  const ids = [...bootIds];
  for (const id of world.clients.keys()) {
    if (!ids.includes(id)) ids.push(id);
  }
  return ids;
}

/** Heal partitions, clear holds/faults, bring clients online, assert converge. */
export async function settleWorld(args: {
  readonly world: SyncSurface;
  readonly ids: readonly string[];
}): Promise<void> {
  args.world.clearFailNextOpen();
  args.world.clearStoragePressure();
  args.world.clearBoundaryFaults();
  const ids = settleClientIds(args.world, args.ids);
  for (const id of ids) {
    args.world.net(id, 'all').set('ok');
  }
  args.world.kit.network.setDefaultFaults(RELIABLE_FAULTS);
  for (const id of ids) {
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
