import fc from 'fast-check';
import type { CommandGeneratorContext, UnboundCommandDef } from './command';
import type { World } from './world-types';

export type PartitionRoles = {
  readonly fromRole: string;
  readonly toRole: string;
};

function rolePairFromContext(
  ctx: CommandGeneratorContext,
  fallback?: PartitionRoles
): PartitionRoles {
  if (fallback !== undefined) return fallback;
  const edge = ctx.edges[0];
  if (edge === undefined) {
    throw new Error(
      'networkCommands: no network.edges declared and no roles provided'
    );
  }
  return { fromRole: edge.fromRole, toRole: edge.toRole };
}

type Endpoints = { readonly from: string; readonly to: string };

function generateEndpoints(
  ctx: CommandGeneratorContext,
  roles: PartitionRoles | undefined
): fc.Arbitrary<Endpoints> {
  const pair = rolePairFromContext(ctx, roles);
  const fromIds = ctx.nodeIds(pair.fromRole);
  const toIds = ctx.nodeIds(pair.toRole);
  if (fromIds.length === 0 || toIds.length === 0) {
    return fc.constant({
      from: fromIds[0] ?? pair.fromRole,
      to: toIds[0] ?? pair.toRole,
    });
  }
  return fc
    .tuple(fc.constantFrom(...fromIds), fc.constantFrom(...toIds))
    .map(([from, to]) => ({ from, to }));
}

function partitionCommand(roles?: PartitionRoles): UnboundCommandDef {
  return {
    generate: (ctx) =>
      generateEndpoints(ctx, roles).map((e) => ({
        kind: 'network.partition' as const,
        ...e,
      })),
    apply: async (world: World, payload: Endpoints) => {
      world.partition(payload.from, payload.to);
    },
  };
}

function healCommand(roles?: PartitionRoles): UnboundCommandDef {
  return {
    generate: (ctx) =>
      generateEndpoints(ctx, roles).map((e) => ({
        kind: 'network.heal' as const,
        ...e,
      })),
    apply: async (world: World, payload: Endpoints) => {
      world.heal(payload.from, payload.to);
    },
  };
}

function healAllCommand(): UnboundCommandDef {
  return {
    generate: () => fc.constant({ kind: 'network.healAll' as const }),
    apply: async (world: World) => {
      world.healAll();
    },
  };
}

export type AdvanceCommandOptions = {
  readonly minMs?: number;
  readonly maxMs?: number;
};

/** Admin Command: advance virtual time by a generated amount. */
export function advanceCommand(
  opts?: AdvanceCommandOptions
): UnboundCommandDef {
  const minMs = opts?.minMs ?? 1;
  const maxMs = opts?.maxMs ?? 500;
  return {
    generate: () =>
      fc.integer({ min: minMs, max: maxMs }).map((ms) => ({
        kind: 'time.advance' as const,
        ms,
      })),
    apply: async (world: World, payload: { readonly ms: number }) => {
      await world.advance(payload.ms);
    },
  };
}

/** Admin Commands that toggle Partition state on the Network model. */
export function networkCommands(roles?: PartitionRoles): {
  readonly 'network.partition': UnboundCommandDef;
  readonly 'network.heal': UnboundCommandDef;
  readonly 'network.healAll': UnboundCommandDef;
} {
  return {
    'network.partition': partitionCommand(roles),
    'network.heal': healCommand(roles),
    'network.healAll': healAllCommand(),
  };
}
