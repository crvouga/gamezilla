import { bootClients, runWorkloadLoop, settleWorld } from './replay-steps';
import { openSimWorld } from './world';

export type RunSeedResult =
  | { readonly ok: true; readonly seed: bigint; readonly steps: number }
  | {
      readonly ok: false;
      readonly seed: bigint;
      readonly steps: number;
      readonly error: string;
    };

export type RunSeedOptions = {
  readonly seed: number | bigint | string;
  readonly clientCount?: number;
  readonly steps?: number;
  readonly sampleFaults?: boolean;
};

/**
 * Run one seeded universe: N clients, random workload, heal + converge.
 * On failure returns seed for exact replay.
 */
export async function runSeed(opts: RunSeedOptions): Promise<RunSeedResult> {
  const clientCount = opts.clientCount ?? 2;
  const steps = opts.steps ?? 40;
  const world = await openSimWorld({
    seed: opts.seed,
    // Boot on a reliable mesh; enable sampled faults after clients are up.
    sampleFaults: false,
  });
  let done = 0;
  try {
    const ids = await bootClients({
      world,
      clientCount,
      sampleFaults: opts.sampleFaults === true,
    });
    const loop = await runWorkloadLoop({ world, ids, steps });
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
