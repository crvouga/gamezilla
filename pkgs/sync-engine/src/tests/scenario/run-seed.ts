import type { Repro } from '@pkgs/dst';
import { defineSurface, REPRO_VERSION, start } from '@pkgs/dst';

import { isStorageFullError } from '../../client/storage-full-error';
import { isClosedDatabaseError } from '../../sim/invariants';
import { bootClients, settleKit } from '../../sim/replay-steps';
import type { SeededRng } from '../../sim/rng';
import {
  defineSyncSystem,
  type SyncSurface,
  syncKnobs,
  syncVirtualHost,
} from '../../sim/scenario';
import type { SyncAction } from '../../sim/scenario/actions';
import type { SyncApp } from '../../sim/scenario/app';
import { dispatchSyncAction } from '../../sim/scenario/dispatch';
import { pickLibraryAction } from './pick-library-action';

const { defineAction } = defineSurface<SyncSurface>();

export type SeedFailureArtifact = {
  readonly repro: Repro & {
    readonly meta: Repro['meta'] & {
      readonly error: string;
      readonly seedHex: string;
      readonly failureStep: number;
    };
  };
  readonly error: string;
};

export type RunSeedResult =
  | { readonly ok: true; readonly seed: bigint; readonly steps: number }
  | {
      readonly ok: false;
      readonly seed: bigint;
      readonly steps: number;
      readonly error: string;
      readonly artifact: SeedFailureArtifact;
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
  readonly artifact: SeedFailureArtifact;
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
}): SeedFailureArtifact {
  return {
    repro: {
      version: REPRO_VERSION,
      seed: args.seed.toString(),
      system: [],
      knobs: null,
      choices: args.actions.map((a) => ({
        action: a.kind,
        draws: [] as number[],
        args: [],
      })),
      meta: {
        system: 'sync.runSeed',
        error: args.error,
        seedHex: args.seed.toString(16),
        failureStep: args.failureStep,
      },
    },
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
  readonly surface: SyncSurface;
  readonly ids: readonly string[];
  readonly steps: number;
  domainModel: unknown | null;
  readonly actions: SyncAction[];
}): Promise<{
  readonly done: number;
  readonly fail: WorkloadLoopFail | null;
}> {
  const workRng = args.surface.rng.fork('workload');
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
      await dispatchSyncAction(args.surface, args.app, action);
    } catch (error) {
      if (isTransientSimFault(error)) {
        done += 1;
        await args.surface.advance(20);
        continue;
      }
      const message = error instanceof Error ? error.message : String(error);
      return {
        done,
        fail: {
          ok: false,
          seed: args.surface.seed,
          steps: done,
          error: message,
          artifact: buildFailureArtifact({
            seed: args.surface.seed,
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
    try {
      await args.surface.checkInvariants();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        done,
        fail: {
          ok: false,
          seed: args.surface.seed,
          steps: done,
          error: message,
          artifact: buildFailureArtifact({
            seed: args.surface.seed,
            actions: args.actions,
            error: message,
            failureStep: args.actions.length,
          }),
        },
      };
    }
    await args.surface.advance(20);
  }
  return { done, fail: null };
}

async function executeSeed(
  surface: SyncSurface,
  opts: RunSeedOptions
): Promise<RunSeedResult> {
  const actions: SyncAction[] = [];
  let done = 0;
  try {
    const ids = await bootClients({
      surface,
      clientCount: opts.clientCount ?? 2,
      sampleFaults: opts.sampleFaults === true,
      dstFaults: opts.dstFaults === true,
    });
    const loop = await runWorkloadLoop({
      app: opts.app,
      surface,
      ids,
      steps: opts.steps ?? 40,
      domainModel: opts.app.domainModel?.initial() ?? null,
      actions,
    });
    done = loop.done;
    if (loop.fail !== null) return loop.fail;
    try {
      await settleKit({ surface, ids });
    } catch (error) {
      if (isTransientSimFault(error)) {
        await settleKit({ surface, ids });
      } else {
        throw error;
      }
    }
    return { ok: true, seed: surface.seed, steps: done };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      seed: surface.seed,
      steps: done,
      error: message,
      artifact: buildFailureArtifact({
        seed: surface.seed,
        actions,
        error: message,
        failureStep: actions.length,
      }),
    };
  }
}

type SeedJob = {
  readonly opts: RunSeedOptions;
  result: RunSeedResult | null;
};

/** Drives the whole seeded workload inside the run; the surface never escapes. */
const seedWorkload = defineAction({
  name: 'seedWorkload',
  generate(job: SeedJob) {
    return {
      weight: 1,
      act: async (s: SyncSurface) => {
        job.result = await executeSeed(s, job.opts);
      },
    };
  },
});

/**
 * Run one seeded universe: N clients, random workload, heal + converge.
 * On failure returns seed + scenario artifact for exact replay.
 */
export async function runSeed(opts: RunSeedOptions): Promise<RunSeedResult> {
  const system = defineSyncSystem(opts.app);
  await using run = await start(system, {
    seed: opts.seed,
    host: syncVirtualHost(),
    knobs: syncKnobs({ clientCount: 0 }),
    properties: [],
  });
  const job: SeedJob = { opts, result: null };
  await run.apply(seedWorkload, job);
  if (job.result === null) {
    throw new Error('sync: seedWorkload did not run');
  }
  return job.result;
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
