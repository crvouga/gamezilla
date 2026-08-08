import { RELIABLE_FAULTS, sampleFaultOptions } from './faults';
import type { SimWorld } from './world';

/** Add N clients and optionally enable sampled network faults. */
export async function bootClients(args: {
  readonly world: SimWorld;
  readonly clientCount: number;
  readonly sampleFaults: boolean;
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
  }
  await args.world.runFor(200);
  return ids;
}

/** Heal partitions, clear holds/faults, bring clients online, assert converge. */
export async function settleWorld(args: {
  readonly world: SimWorld;
  readonly ids: readonly string[];
}): Promise<void> {
  args.world.releaseAll();
  args.world.healAll();
  args.world.clearFaults();
  args.world.network.setDefaultFaults(RELIABLE_FAULTS);
  for (const id of args.ids) {
    if (!args.world.clients.has(id)) {
      await args.world.restartClient(id);
    }
    args.world.clients.get(id)?.lifecycle.setOnline(true);
    args.world.clients.get(id)?.lifecycle.setForeground(true);
  }
  await args.world.assertConverged();
}
