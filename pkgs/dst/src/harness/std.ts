import fc from 'fast-check';
import type { ActionGeneratorContext, UnboundActionDef } from './actions';
import type { Base } from './base-surface';
import type { World } from './world-types';

export type PartitionRoles = {
  readonly fromRole: string;
  readonly toRole: string;
};

type Endpoints = { readonly from: string; readonly to: string };

function rolePairFromContext(
  ctx: ActionGeneratorContext<Base>,
  fallback?: PartitionRoles
): PartitionRoles {
  if (fallback !== undefined) return fallback;
  const edge = ctx.edges[0];
  if (edge === undefined) {
    throw new Error(
      'std.network: no network.edges declared and no roles provided'
    );
  }
  return { fromRole: edge.fromRole, toRole: edge.toRole };
}

function generateEndpoints(
  ctx: ActionGeneratorContext<Base>,
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

function asWorld(surface: Base): World {
  return surface as unknown as World;
}

async function healWeight(surface: Base): Promise<number> {
  const world = asWorld(surface);
  for (const edge of world.edges) {
    for (const from of world.nodeIds(edge.fromRole)) {
      for (const to of world.nodeIds(edge.toRole)) {
        if (from !== to && world.network.isPartitioned(from, to)) return 1;
      }
    }
  }
  return world.network.held().length > 0 ? 1 : 0;
}

function partitionAction(
  roles?: PartitionRoles
): UnboundActionDef<Endpoints, Base> {
  return {
    generate: (ctx) =>
      generateEndpoints(ctx, roles).map((e) => ({
        kind: 'network.partition' as const,
        ...e,
      })),
    apply: (surface, payload) => {
      surface.partition(payload.from, payload.to);
    },
  };
}

function healAction(roles?: PartitionRoles): UnboundActionDef<Endpoints, Base> {
  return {
    weight: healWeight,
    generate: (ctx) =>
      generateEndpoints(ctx, roles).map((e) => ({
        kind: 'network.heal' as const,
        ...e,
      })),
    apply: (surface, payload) => {
      surface.heal(payload.from, payload.to);
    },
  };
}

function healAllAction(): UnboundActionDef<
  { readonly kind: 'network.healAll' },
  Base
> {
  return {
    weight: healWeight,
    generate: () => fc.constant({ kind: 'network.healAll' as const }),
    apply: (surface) => {
      surface.healAll();
    },
  };
}

export type AdvanceActionOptions = {
  readonly minMs?: number;
  readonly maxMs?: number;
};

function timeAction(
  opts?: AdvanceActionOptions
): UnboundActionDef<
  { readonly kind: 'time.advance'; readonly ms: number },
  Base
> {
  const minMs = opts?.minMs ?? 1;
  const maxMs = opts?.maxMs ?? 500;
  return {
    generate: () =>
      fc.integer({ min: minMs, max: maxMs }).map((ms) => ({
        kind: 'time.advance' as const,
        ms,
      })),
    apply: async (surface, payload) => {
      await surface.advance(payload.ms);
    },
  };
}

type StdCatalog = Record<string, UnboundActionDef<unknown, Base>>;

export const std = {
  network(roles?: PartitionRoles): StdCatalog {
    return {
      'network.partition': partitionAction(roles) as UnboundActionDef<
        unknown,
        Base
      >,
      'network.heal': healAction(roles) as UnboundActionDef<unknown, Base>,
      'network.healAll': healAllAction() as UnboundActionDef<unknown, Base>,
    };
  },
  time(opts?: AdvanceActionOptions): StdCatalog {
    return {
      'time.advance': timeAction(opts) as UnboundActionDef<unknown, Base>,
    };
  },
};
