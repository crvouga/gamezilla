import { isStorageFullError } from '../../client/storage-full-error';
import type { DstAction } from '../../sim/dst/actions';
import type { DstApp } from '../../sim/dst/app';
import { dispatchDstAction } from '../../sim/dst/dispatch';
import { isClosedDatabaseError } from '../../sim/invariants';
import { bootClients, settleWorld } from '../../sim/replay-steps';
import type { SeededRng } from '../../sim/rng';
import { openWorld } from '../../sim/world';
import { pickLibraryAction } from './pick-library-action';

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

function isTransientSimFault(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (error.message.includes('sim: crash during epoch migrate')) return true;
  if (error.message === 'sim: fail next open') return true;
  if (isStorageFullError(error)) return true;
  if (isClosedDatabaseError(error)) return true;
  return false;
}

async function pickWorkloadAction(args: {
  readonly rng: SeededRng;
  readonly clientIds: readonly string[];
  readonly app: DstApp;
  readonly domainModel: unknown | null;
}): Promise<{
  readonly action: DstAction;
  readonly domainModel: unknown | null;
}> {
  const { rng, clientIds, app, domainModel } = args;
  const domainRoll = rng.int(100) < 46;
  if (domainRoll && app.pickDomainOrServerOp !== undefined) {
    const hooks = app.domainModel;
    for (let attempt = 0; attempt < 48; attempt += 1) {
      const op = app.pickDomainOrServerOp(rng, clientIds);
      if (hooks !== undefined && domainModel !== null) {
        if (!hooks.allows(domainModel, op)) continue;
      }
      return { action: op, domainModel };
    }
    return {
      action: { kind: 'idle', ms: 1 + rng.int(20) },
      domainModel,
    };
  }
  const action = pickLibraryAction(rng, clientIds);
  if (
    action.kind === 'heal' &&
    app.domainModel?.onHeal !== undefined &&
    domainModel !== null
  ) {
    app.domainModel.onHeal(domainModel);
  }
  return { action, domainModel };
}

async function runWorkloadLoop(args: {
  readonly app: DstApp;
  readonly world: Awaited<ReturnType<typeof openWorld>>;
  readonly ids: readonly string[];
  readonly steps: number;
  domainModel: unknown | null;
}): Promise<{
  readonly done: number;
  readonly fail: WorkloadLoopFail | null;
}> {
  const workRng = args.world.rng.fork('workload');
  let domainModel = args.domainModel;
  let done = 0;
  for (let i = 0; i < args.steps; i += 1) {
    const picked = await pickWorkloadAction({
      rng: workRng,
      clientIds: args.ids,
      app: args.app,
      domainModel,
    });
    domainModel = picked.domainModel;
    const action = picked.action;
    try {
      await dispatchDstAction(args.world, args.app, action);
    } catch (error) {
      if (isTransientSimFault(error)) {
        done += 1;
        await args.world.runFor(20);
        continue;
      }
      const message = error instanceof Error ? error.message : String(error);
      return {
        done,
        fail: {
          ok: false,
          seed: args.world.seed,
          steps: done,
          error: message,
        },
      };
    }
    if (
      args.app.domainModel !== undefined &&
      domainModel !== null &&
      (action.kind === 'domain' || action.kind === 'server')
    ) {
      args.app.domainModel.apply(domainModel, action);
    }
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
  // Domain-only open so we can boot clients with optional fault sampling.
  await using world = await openWorld({
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
      domainModel: opts.app.domainModel?.initial() ?? null,
    });
    done = loop.done;
    if (loop.fail !== null) return loop.fail;
    try {
      await settleWorld({ world, ids });
    } catch (error) {
      if (isTransientSimFault(error)) {
        await settleWorld({ world, ids });
      } else {
        throw error;
      }
    }
    return { ok: true, seed: world.seed, steps: done };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      seed: world.seed,
      steps: done,
      error: message,
    };
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
