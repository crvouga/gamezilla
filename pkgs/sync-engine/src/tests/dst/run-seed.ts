import { bootClients, settleWorld } from '../../sim/replay-steps';
import { openSimWorld } from '../../sim/world';
import type { DstAction } from './actions';
import type { DstApp } from './app';
import { dispatchDstAction } from './dispatch';
import { pickDstAction } from './pick-library-action';

export type RunSeedResult =
  | { readonly ok: true; readonly seed: bigint; readonly steps: number }
  | {
      readonly ok: false;
      readonly seed: bigint;
      readonly steps: number;
      readonly error: string;
    };

export type RunSeedOptions = {
  readonly app: DstApp;
  readonly seed: number | bigint | string;
  readonly clientCount?: number;
  readonly steps?: number;
  readonly sampleFaults?: boolean;
  /** Mild fixed reorder/loss (see {@link DST_FAULTS}). */
  readonly dstFaults?: boolean;
};

type WorkloadLoopFail = {
  readonly ok: false;
  readonly seed: bigint;
  readonly steps: number;
  readonly error: string;
};

async function runWorkloadLoop(args: {
  readonly app: DstApp;
  readonly world: Awaited<ReturnType<typeof openSimWorld>>;
  readonly ids: readonly string[];
  readonly steps: number;
}): Promise<{
  readonly done: number;
  readonly fail: WorkloadLoopFail | null;
}> {
  const workRng = args.world.rng.fork('workload');
  let done = 0;
  for (let i = 0; i < args.steps; i += 1) {
    const action: DstAction = pickDstAction(
      workRng,
      args.ids,
      args.app.pickDomainOrServerOp
    );
    await dispatchDstAction(args.world, args.app, action);
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

/**
 * Run one seeded universe: N clients, random workload, heal + converge.
 * On failure returns seed for exact replay.
 */
export async function runDstSeed(opts: RunSeedOptions): Promise<RunSeedResult> {
  const clientCount = opts.clientCount ?? 2;
  const steps = opts.steps ?? 40;
  const world = await openSimWorld({
    seed: opts.seed,
    domain: opts.app.pack,
    sampleFaults: false,
  });
  let done = 0;
  try {
    const ids = await bootClients({
      world,
      clientCount,
      sampleFaults: opts.sampleFaults === true,
      dstFaults: opts.dstFaults === true,
    });
    const loop = await runWorkloadLoop({
      app: opts.app,
      world,
      ids,
      steps,
    });
    done = loop.done;
    if (loop.fail !== null) return loop.fail;
    await settleWorld({ world, ids });
    return { ok: true, seed: world.seed, steps: done };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      seed: world.seed,
      steps: done,
      error: message,
    };
  } finally {
    await world.dispose();
  }
}

/** Parse SYNC_SIM_SEED / SYNC_SIM_SEEDS env for CI / local replay. */
export function seedsFromEnv(env: {
  readonly SYNC_SIM_SEED?: string | undefined;
  readonly SYNC_SIM_SEEDS?: string | undefined;
}): number[] {
  if (env.SYNC_SIM_SEED !== undefined && env.SYNC_SIM_SEED.length > 0) {
    return [Number.parseInt(env.SYNC_SIM_SEED, 10)];
  }
  if (env.SYNC_SIM_SEEDS !== undefined && env.SYNC_SIM_SEEDS.length > 0) {
    return env.SYNC_SIM_SEEDS.split(',')
      .map((s) => Number.parseInt(s.trim(), 10))
      .filter((n) => Number.isFinite(n));
  }
  return [];
}
