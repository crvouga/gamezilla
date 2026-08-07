import { RELIABLE_FAULTS, sampleFaultOptions } from './faults';
import { applyWorkloadAction, generateWorkload } from './workload';
import type { SimWorld } from './world';

export type WorkloadLoopFail = {
  readonly ok: false;
  readonly seed: bigint;
  readonly steps: number;
  readonly error: string;
};

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

/**
 * Apply workload actions; returns a failure result if an invariant breaks,
 * otherwise null (caller should settle).
 */
export async function runWorkloadLoop(args: {
  readonly world: SimWorld;
  readonly ids: readonly string[];
  readonly steps: number;
}): Promise<{
  readonly done: number;
  readonly fail: WorkloadLoopFail | null;
}> {
  const workRng = args.world.rng.fork('workload');
  let done = 0;
  for (const action of generateWorkload(workRng, args.ids, args.steps)) {
    await applyWorkloadAction(args.world, action);
    done += 1;
    const inv = await args.world.checkInvariants();
    if (inv !== null) {
      return {
        done,
        fail: {
          ok: false,
          seed: args.world.seed,
          steps: done,
          error: `${inv.invariant}: ${inv.detail}`,
        },
      };
    }
    await args.world.runFor(20);
  }
  return { done, fail: null };
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
