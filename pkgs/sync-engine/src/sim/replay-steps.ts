import { DST_FAULTS, RELIABLE_FAULTS, sampleFaultOptions } from './faults';
import type { SimWorld } from './world-api';

/** Add N clients and optionally enable DST / sampled network faults. */
export async function bootClients(args: {
  readonly world: SimWorld;
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
  readonly world: SimWorld;
  readonly ids: readonly string[];
}): Promise<void> {
  for (const id of args.ids) {
    args.world.net(id, 'all').set('ok');
  }
  args.world.network.setDefaultFaults(RELIABLE_FAULTS);
  for (const id of args.ids) {
    if (!args.world.clients.has(id)) {
      await args.world.node(id).restart({ preserveLocalDb: true });
    }
    args.world.clients.get(id)?.online(true);
    args.world.clients.get(id)?.foreground(true);
  }
  await args.world.assertConverged();
}
