import {
  actions,
  defineScenario,
  type KnobValues,
  knob,
  openWorld,
  properties,
  property,
  type ScenarioDef,
  std,
} from '@pkgs/dst';
import fc from 'fast-check';
import type { MatchmakingSimBackend, MatchmakingSimKit } from '../world-api';
import { assertReplicaAgreement, buildMatchmakingKit } from './facade';
import { MM_BACKEND, mmReplicaNode, mmStoreNode } from './node-kinds';
import {
  createMatchmakingSystemConfig,
  type MatchmakingSystemConfig,
  type MatchmakingSystemOpts,
} from './system';

const WORLD_START_MS = 1_700_000_000_000;

const REPLICA_COUNT = knob(1, fc.integer({ min: 1, max: 3 }));

type MatchmakingKnobs = {
  readonly replicaCount: typeof REPLICA_COUNT;
  readonly backend: typeof MM_BACKEND;
};

type MatchmakingNodeEntries = {
  readonly store: typeof mmStoreNode;
  readonly replica: ReturnType<typeof mmReplicaNode> & {
    readonly count: (knobs: KnobValues<MatchmakingKnobs>) => number;
    readonly id: (index: number) => string;
  };
};

export type MatchmakingSurface = MatchmakingSimKit;

export type MatchmakingSystemDef = ScenarioDef<
  MatchmakingKnobs,
  MatchmakingNodeEntries,
  MatchmakingSurface,
  MatchmakingSurface
>;

export type MatchmakingSystemWorld = import('@pkgs/dst').World<
  MatchmakingKnobs,
  Record<string, import('@pkgs/dst').NodeEntry>,
  MatchmakingSurface
>;

export type DefineMatchmakingSystemOpts = MatchmakingSystemOpts & {
  readonly id?: string;
};

function defineMatchmakingSystemInner(
  config: MatchmakingSystemConfig,
  opts?: DefineMatchmakingSystemOpts
): MatchmakingSystemDef {
  const matchmakingActions = actions<MatchmakingSurface>()({
    tickAll: {
      weight: 1,
      generate: () => fc.constant({ kind: 'tickAll' as const }),
      apply: async (surface) => {
        await surface.tickAll({ maxPassesPerPartition: 2 });
      },
    },
    ...std.time(),
  });

  return defineScenario({
    id: opts?.id ?? 'matchmaking.replicas',
    startTime: WORLD_START_MS,
    knobs: {
      replicaCount: REPLICA_COUNT,
      backend: MM_BACKEND,
    },
    nodes: {
      store: mmStoreNode,
      replica: {
        ...mmReplicaNode(config),
        count: (k: KnobValues<MatchmakingKnobs>) => k.replicaCount,
        id: (i) => `r${String(i)}`,
      },
    },
    actions:
      matchmakingActions as import('@pkgs/dst').ActionCatalog<MatchmakingSurface>,
    properties: properties<MatchmakingSurface>()({
      converged: property.always(async () => true, { at: 'converge' }),
    }),
    extend: (world) =>
      buildMatchmakingKit({
        world,
        config,
        rng: world.ports.rng,
      }),
    converge: async (world) => {
      await world.tickAll({ maxPassesPerPartition: 4 });
      await world.quiesce();
      await assertReplicaAgreement(world);
    },
  });
}

/**
 * Framework-owned matchmaking world: shared SQL store + N replicas.
 * Kit surface is merged onto the opened world via `extend`.
 */
export function defineMatchmakingSystem(
  opts?: DefineMatchmakingSystemOpts
): MatchmakingSystemDef {
  return defineMatchmakingSystemInner(
    createMatchmakingSystemConfig(opts),
    opts
  );
}

export const MATCHMAKING_SYSTEM = defineMatchmakingSystem();

export type OpenMatchmakingWorldArgs = {
  readonly seed: number | bigint | string;
  readonly replicas?: number;
  readonly backend?: MatchmakingSimBackend;
  readonly schema?: import('../../interface/schema').MatchmakingSchema;
  readonly radius?: import('../../interface/types').RadiusOptions;
  readonly tuning?: Partial<
    import('../../interface/matchmaking').MatchmakingTuning
  >;
  readonly startTime?: number;
};

/**
 * Thin opener over framework {@link openWorld}. Returns the framework World
 * with matchmaking kit methods merged via `extend`.
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
    ...(args.startTime !== undefined ? { startTime: args.startTime } : {}),
  });
}
