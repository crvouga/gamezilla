import fc from 'fast-check';
import type { ActionArbContext, UnboundActionDef } from './action';

type ChaosWorld = {
  partition(from: string, to: string): void;
  heal(from: string, to: string): void;
  healAll(): void;
  advance(ms: number): Promise<void>;
};

export type ChaosPartitionRoles = {
  readonly fromRole: string;
  readonly toRole: string;
};

function rolePairFromCtx(
  ctx: ActionArbContext,
  fallback?: ChaosPartitionRoles
): ChaosPartitionRoles {
  if (fallback !== undefined) return fallback;
  const edge = ctx.edges[0];
  if (edge === undefined) {
    throw new Error(
      'chaos.network: no network.edges declared and no roles provided'
    );
  }
  return { fromRole: edge.fromRole, toRole: edge.toRole };
}

function partitionAction(roles?: ChaosPartitionRoles): UnboundActionDef {
  return {
    arb: (ctx) => {
      const pair = rolePairFromCtx(ctx, roles);
      const fromIds = ctx.ids(pair.fromRole);
      const toIds = ctx.ids(pair.toRole);
      if (fromIds.length === 0 || toIds.length === 0) {
        return fc.constant({
          kind: 'chaos.partition' as const,
          from: fromIds[0] ?? pair.fromRole,
          to: toIds[0] ?? pair.toRole,
        });
      }
      return fc
        .tuple(fc.constantFrom(...fromIds), fc.constantFrom(...toIds))
        .map(([from, to]) => ({
          kind: 'chaos.partition' as const,
          from,
          to,
        }));
    },
    dispatch: async (world, action) => {
      const w = world as ChaosWorld;
      const a = action as { from: string; to: string };
      w.partition(a.from, a.to);
    },
  };
}

function healAction(roles?: ChaosPartitionRoles): UnboundActionDef {
  return {
    arb: (ctx) => {
      const pair = rolePairFromCtx(ctx, roles);
      const fromIds = ctx.ids(pair.fromRole);
      const toIds = ctx.ids(pair.toRole);
      if (fromIds.length === 0 || toIds.length === 0) {
        return fc.constant({
          kind: 'chaos.heal' as const,
          from: fromIds[0] ?? pair.fromRole,
          to: toIds[0] ?? pair.toRole,
        });
      }
      return fc
        .tuple(fc.constantFrom(...fromIds), fc.constantFrom(...toIds))
        .map(([from, to]) => ({
          kind: 'chaos.heal' as const,
          from,
          to,
        }));
    },
    dispatch: async (world, action) => {
      const w = world as ChaosWorld;
      const a = action as { from: string; to: string };
      w.heal(a.from, a.to);
    },
  };
}

function healAllAction(): UnboundActionDef {
  return {
    arb: () => fc.constant({ kind: 'chaos.healAll' as const }),
    dispatch: async (world) => {
      (world as ChaosWorld).healAll();
    },
  };
}

export type ChaosAdvanceOpts = {
  readonly minMs?: number;
  readonly maxMs?: number;
};

function advanceAction(opts?: ChaosAdvanceOpts): UnboundActionDef {
  const minMs = opts?.minMs ?? 1;
  const maxMs = opts?.maxMs ?? 500;
  return {
    arb: () =>
      fc.integer({ min: minMs, max: maxMs }).map((ms) => ({
        kind: 'chaos.advance' as const,
        ms,
      })),
    dispatch: async (world, action) => {
      await (world as ChaosWorld).advance((action as { ms: number }).ms);
    },
  };
}

export const chaos = {
  network(roles?: ChaosPartitionRoles): {
    readonly 'chaos.partition': UnboundActionDef;
    readonly 'chaos.heal': UnboundActionDef;
    readonly 'chaos.healAll': UnboundActionDef;
  } {
    return {
      'chaos.partition': partitionAction(roles),
      'chaos.heal': healAction(roles),
      'chaos.healAll': healAllAction(),
    };
  },
  advance(opts?: ChaosAdvanceOpts): UnboundActionDef {
    return advanceAction(opts);
  },
};
