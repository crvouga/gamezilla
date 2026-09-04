import {
  defineAction,
  defineKnob,
  defineSystem,
  openWorld,
  type SystemDef,
  stdAdvance,
  type World,
} from '@pkgs/determinism';
import fc from 'fast-check';

import type { MatchmakingTuning } from '../../interface/matchmaking';
import type { MatchmakingSchema } from '../../interface/schema';
import type { RadiusOptions } from '../../interface/types';
import type { MatchmakingSimBackend } from '../world-api';
import { buildMatchmakingFacade } from './facade';
import { mmReplicaNode, mmStoreNode } from './node-kinds';
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

const tickAllAction = defineAction<
  MatchmakingSystem,
  { readonly kind: 'tickAll' }
>({
  kind: 'tickAll',
  class: 'library',
  arb: () => fc.constant({ kind: 'tickAll' as const }),
  dispatch: async (world) => {
    await requireMmWorld(world.state).tickAll({ maxPassesPerPartition: 2 });
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
      defineKnob({
        id: 'replicaCount',
        default: 1,
        arb: fc.integer({ min: 1, max: 3 }),
      }),
      defineKnob({
        id: 'backend',
        default: 'sqlite' as MatchmakingSimBackend,
        arb: fc.constant('sqlite' as MatchmakingSimBackend),
      }),
    ],
    nodes: [
      {
        kind: mmStoreNode,
        role: 'store',
        count: 1,
      },
      {
        kind: mmReplicaNode,
        role: 'replica',
        countFromKnob: 'replicaCount',
        idFor: (i) => `r${String(i)}`,
      },
    ],
    state: () =>
      createMatchmakingSystem({
        ...(opts?.schema !== undefined ? { schema: opts.schema } : {}),
        ...(opts?.radius !== undefined ? { radius: opts.radius } : {}),
        ...(opts?.tuning !== undefined ? { tuning: opts.tuning } : {}),
      }),
    actions: [tickAllAction, stdAdvance<MatchmakingSystem>()],
    model: {
      initial: () => ({}),
    },
    prepare: async (world) => {
      world.state.facade = buildMatchmakingFacade({
        system: world.state,
        seed: world.seed,
        clock: world.clock,
        rng: world.deps.rng,
      });
    },
    settle: async (world) => {
      await requireMmWorld(world.state).tickAll({ maxPassesPerPartition: 4 });
      await world.idle();
    },
    invariants: async () => null,
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
 * Thin opener over framework {@link openWorld}. Returns the framework World;
 * reach the matchmaking facade via {@link requireMmWorld}(`world.state`).
 */

export async function openMatchmakingWorld(
  args: OpenMatchmakingWorldArgs
): Promise<MatchmakingSystemWorld> {
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

  return openWorld(system, {
    seed: args.seed,
    knobs: {
      replicaCount: args.replicas ?? 1,
      backend: args.backend ?? 'sqlite',
    },
    ...(args.startMs !== undefined ? { startMs: args.startMs } : {}),
  });
}

export { requireMmWorld };
