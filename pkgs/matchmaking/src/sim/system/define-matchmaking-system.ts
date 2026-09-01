import {
  defineLibrary,
  defineSystem,
  defineSystemKnob,
  openWorld,
  type SystemDef,
  type World,
} from '@pkgs/determinism';
import fc from 'fast-check';

import type { MatchmakingTuning } from '../../interface/matchmaking';
import type { MatchmakingSchema } from '../../interface/schema';
import type { RadiusOptions } from '../../interface/types';
import type { MatchmakingSimBackend, MatchmakingSimWorld } from '../world-api';
import './node-kinds';
import { MM_REPLICA, MM_STORE, MM_WARMUP } from './node-kinds';
import {
  createMatchmakingSystem,
  type MatchmakingSystem,
  type MatchmakingSystemOpts,
  requireMmWorld,
} from './system';

const WORLD_START_MS = 1_700_000_000_000;

export type MatchmakingSystemDef = SystemDef<MatchmakingSystem>;
export type MatchmakingSystemWorld = World<MatchmakingSystem>;

export type DefineMatchmakingSystemOpts = MatchmakingSystemOpts & {
  readonly id?: string;
};

const tickAllLibrary = defineLibrary<MatchmakingSystem>({
  kind: 'tickAll',
  arb: () => fc.constant({ kind: 'tickAll' as const }),
  dispatch: async (world) => {
    await requireMmWorld(world.system).tickAll({ maxPassesPerPartition: 2 });
  },
});

const advanceClockLibrary = defineLibrary<MatchmakingSystem>({
  kind: 'advanceClock',
  arb: () =>
    fc.integer({ min: 1, max: 500 }).map((ms) => ({
      kind: 'advanceClock' as const,
      ms,
    })),
  dispatch: async (world, action) => {
    const ms = (action as { readonly ms: number }).ms;
    await requireMmWorld(world.system).runFor(ms);
  },
});

/**
 * Framework-owned matchmaking world: shared SQL store + N replicas.
 * Concurrent `tickAll` claim races need knob `backend: 'postgres'`.
 */
export function defineMatchmakingSystem(
  opts?: DefineMatchmakingSystemOpts
): MatchmakingSystemDef {
  return defineSystem<MatchmakingSystem>({
    id: opts?.id ?? 'matchmaking.replicas',
    startMs: WORLD_START_MS,
    knobs: [
      defineSystemKnob<number>({
        id: 'replicaCount',
        default: 1,
        arb: fc.integer({ min: 1, max: 3 }),
      }),
      defineSystemKnob<MatchmakingSimBackend>({
        id: 'backend',
        default: 'sqlite',
        arb: fc.constant('sqlite' as MatchmakingSimBackend),
      }),
    ],
    nodes: [
      { kind: MM_STORE, role: 'store', count: 1 },
      {
        kind: MM_REPLICA,
        role: 'replica',
        countFromKnob: 'replicaCount',
        idFor: (i) => `r${String(i)}`,
      },
      { kind: MM_WARMUP, role: 'warmup', count: 1 },
    ],
    system: () =>
      createMatchmakingSystem({
        ...(opts?.schema !== undefined ? { schema: opts.schema } : {}),
        ...(opts?.radius !== undefined ? { radius: opts.radius } : {}),
        ...(opts?.tuning !== undefined ? { tuning: opts.tuning } : {}),
      }),
    library: [tickAllLibrary, advanceClockLibrary],
    settle: async (world) => {
      await requireMmWorld(world.system).tickAll({ maxPassesPerPartition: 4 });
      await world.runUntilIdle();
    },
  });
}

export const MATCHMAKING_SYSTEM = defineMatchmakingSystem();

export type OpenMatchmakingWorldArgs = {
  readonly seed: number | bigint | string;
  readonly replicas?: number;
  readonly backend?: MatchmakingSimBackend;
  readonly schema?: MatchmakingSchema;
  readonly radius?: RadiusOptions;
  readonly tuning?: Partial<MatchmakingTuning>;
  readonly startMs?: number;
};

/**
 * Thin opener over framework {@link openWorld}. Returns the matchmaking
 * facade; disposing it disposes the framework world (and closes the store).
 */
export async function openMatchmakingWorld(
  args: OpenMatchmakingWorldArgs
): Promise<MatchmakingSimWorld> {
  const needsCustom =
    args.schema !== undefined ||
    args.radius !== undefined ||
    args.tuning !== undefined;
  const system = needsCustom
    ? defineMatchmakingSystem({
        ...(args.schema !== undefined ? { schema: args.schema } : {}),
        ...(args.radius !== undefined ? { radius: args.radius } : {}),
        ...(args.tuning !== undefined ? { tuning: args.tuning } : {}),
      })
    : MATCHMAKING_SYSTEM;

  const fw = await openWorld(system, {
    seed: args.seed,
    knobs: {
      replicaCount: args.replicas ?? 1,
      backend: args.backend ?? 'sqlite',
    },
    ...(args.startMs !== undefined ? { startMs: args.startMs } : {}),
  });

  const facade = requireMmWorld(fw.system);
  let disposed = false;
  const dispose = async (): Promise<void> => {
    if (disposed) return;
    disposed = true;
    await fw.dispose();
  };
  return new Proxy(facade, {
    get(target, prop, receiver) {
      if (prop === 'dispose' || prop === Symbol.asyncDispose) {
        return dispose;
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}

export { requireMmWorld };
