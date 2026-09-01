import {
  type JsonValue,
  openWorld,
  type SimFailureArtifact,
} from '@pkgs/determinism';

import { isStorageFullError } from '../../client/storage-full-error';
import { RELIABLE_FAULTS } from '../../sim/faults';
import { isClosedDatabaseError } from '../../sim/invariants';
import { toKernelFaults } from '../../sim/network';
import { bootClients, settleWorld } from '../../sim/replay-steps';
import type { SeededRng } from '../../sim/rng';
import { defineSyncSystem, syncFacade } from '../../sim/system';
import type { SyncAction } from '../../sim/system/actions';
import type { SyncApp } from '../../sim/system/app';
import { dispatchSyncAction } from '../../sim/system/dispatch';
import type { SyncSystemFacade } from '../../sim/system/system';
import { pickLibraryAction } from './pick-library-action';

const WORLD_START_MS = 1_700_000_000_000;

export type RunSeedResult =
  | { readonly ok: true; readonly seed: bigint; readonly steps: number }
  | {
      readonly ok: false;
      readonly seed: bigint;
      readonly steps: number;
      readonly error: string;
      readonly artifact: SimFailureArtifact;
    };

export type RunSeedOptions = {
  readonly app: SyncApp;
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
  readonly artifact: SimFailureArtifact;
};

function isTransientSimFault(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (error.message.includes('sim: crash during epoch migrate')) return true;
  if (error.message === 'sim: fail next open') return true;
  if (isStorageFullError(error)) return true;
  if (isClosedDatabaseError(error)) return true;
  return false;
}

function buildFailureArtifact(args: {
  readonly seed: bigint;
  readonly actions: readonly SyncAction[];
  readonly error: string;
  readonly failureStep: number;
}): SimFailureArtifact {
  return {
    scenario: {
      version: 1,
      inputs: {
        seed: args.seed.toString(),
        startMs: WORLD_START_MS,
        knobs: {},
        actions: args.actions as readonly JsonValue[],
        networkDefaults: toKernelFaults(RELIABLE_FAULTS),
      },
      meta: {
        error: args.error,
        seedHex: args.seed.toString(16),
        failureStep: args.failureStep,
      },
    },
    trace: [],
    error: args.error,
  };
}

async function pickWorkloadAction(args: {
  readonly rng: SeededRng;
  readonly clientIds: readonly string[];
  readonly app: SyncApp;
  readonly domainModel: unknown | null;
}): Promise<{
  readonly action: SyncAction;
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
  readonly app: SyncApp;
  readonly world: SyncSystemFacade;
  readonly ids: readonly string[];
  readonly steps: number;
  domainModel: unknown | null;
  readonly actions: SyncAction[];
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
    args.actions.push(action);
    try {
      await dispatchSyncAction(args.world, args.app, action);
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
          artifact: buildFailureArtifact({
            seed: args.world.seed,
            actions: args.actions,
            error: message,
            failureStep: args.actions.length,
          }),
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
      const message = `${inv.invariant}: ${inv.detail}`;
      return {
        done,
        fail: {
          ok: false,
          seed: args.world.seed,
          steps: done,
          error: message,
          artifact: buildFailureArtifact({
            seed: args.world.seed,
            actions: args.actions,
            error: message,
            failureStep: args.actions.length,
          }),
        },
      };
    }
    await args.world.runFor(20);
  }
  return { done, fail: null };
}

/**
 * Run one seeded universe: N clients, random workload, heal + converge.
 * On failure returns seed + scenario artifact for exact replay.
 */
export async function runSeed(opts: RunSeedOptions): Promise<RunSeedResult> {
  const clientCount = opts.clientCount ?? 2;
  const steps = opts.steps ?? 40;
  // clientCount: 0 so bootClients owns ids + optional fault sampling.
  await using host = await openWorld(defineSyncSystem(opts.app), {
    seed: opts.seed,
    knobs: { clientCount: 0 },
  });
  const world = syncFacade(host.system);
  const actions: SyncAction[] = [];
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
      actions,
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
      artifact: buildFailureArtifact({
        seed: world.seed,
        actions,
        error: message,
        failureStep: actions.length,
      }),
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
