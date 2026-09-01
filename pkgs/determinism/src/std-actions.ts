import fc from 'fast-check';
import type { ActionArbContext, ActionDef } from './action';
import type { World } from './world-types';

export type StdPartitionRoles = {
  readonly fromRole: string;
  readonly toRole: string;
};

function rolePairFromCtx(
  ctx: ActionArbContext,
  fallback?: StdPartitionRoles
): StdPartitionRoles {
  if (fallback !== undefined) return fallback;
  const edge = ctx.edges[0];
  if (edge === undefined) {
    throw new Error(
      'stdNetChaos: no network.edges declared and no roles provided'
    );
  }
  return { fromRole: edge.fromRole, toRole: edge.toRole };
}

/**
 * Partition one random node of `fromRole` from one random node of `toRole`
 * (by node id — World expands to endpoint pairs).
 */
export function stdPartition<S, F = unknown>(
  roles?: StdPartitionRoles
): ActionDef<
  S,
  {
    readonly kind: 'std.partition';
    readonly from: string;
    readonly to: string;
  },
  object,
  F
> {
  return {
    kind: 'std.partition',
    class: 'library',
    arb: (ctx: ActionArbContext) => {
      const pair = rolePairFromCtx(ctx, roles);
      const fromIds = ctx.roleIds(pair.fromRole);
      const toIds = ctx.roleIds(pair.toRole);
      if (fromIds.length === 0 || toIds.length === 0) {
        return fc.constant({
          kind: 'std.partition' as const,
          from: fromIds[0] ?? pair.fromRole,
          to: toIds[0] ?? pair.toRole,
        });
      }
      return fc
        .tuple(fc.constantFrom(...fromIds), fc.constantFrom(...toIds))
        .map(([from, to]) => ({
          kind: 'std.partition' as const,
          from,
          to,
        }));
    },
    dispatch: async (world, action) => {
      world.partition(action.from, action.to);
    },
  };
}

/**
 * Heal the edge between one random pair (same role pick as partition).
 */
export function stdHeal<S, F = unknown>(
  roles?: StdPartitionRoles
): ActionDef<
  S,
  { readonly kind: 'std.heal'; readonly from: string; readonly to: string },
  object,
  F
> {
  return {
    kind: 'std.heal',
    class: 'library',
    arb: (ctx: ActionArbContext) => {
      const pair = rolePairFromCtx(ctx, roles);
      const fromIds = ctx.roleIds(pair.fromRole);
      const toIds = ctx.roleIds(pair.toRole);
      if (fromIds.length === 0 || toIds.length === 0) {
        return fc.constant({
          kind: 'std.heal' as const,
          from: fromIds[0] ?? pair.fromRole,
          to: toIds[0] ?? pair.toRole,
        });
      }
      return fc
        .tuple(fc.constantFrom(...fromIds), fc.constantFrom(...toIds))
        .map(([from, to]) => ({
          kind: 'std.heal' as const,
          from,
          to,
        }));
    },
    dispatch: async (world, action) => {
      world.heal(action.from, action.to);
    },
  };
}

export function stdHealAll<S, F = unknown>(): ActionDef<
  S,
  { readonly kind: 'std.healAll' },
  object,
  F
> {
  return {
    kind: 'std.healAll',
    class: 'library',
    arb: () => fc.constant({ kind: 'std.healAll' as const }),
    dispatch: async (world) => {
      world.healAll();
    },
  };
}

export type StdAdvanceOpts = {
  readonly minMs?: number;
  readonly maxMs?: number;
};

export function stdAdvance<S, F = unknown>(
  opts?: StdAdvanceOpts
): ActionDef<
  S,
  { readonly kind: 'std.advance'; readonly ms: number },
  object,
  F
> {
  const minMs = opts?.minMs ?? 1;
  const maxMs = opts?.maxMs ?? 500;
  return {
    kind: 'std.advance',
    class: 'library',
    arb: () =>
      fc.integer({ min: minMs, max: maxMs }).map((ms) => ({
        kind: 'std.advance' as const,
        ms,
      })),
    dispatch: async (world: World<S, F>, action) => {
      await world.advance(action.ms);
    },
  };
}

/**
 * Bundle of common chaos actions.
 * When `roles` is omitted, derives the pair from `SystemDef.network.edges[0]`.
 */
export function stdNetChaos<S, F = unknown>(
  roles?: StdPartitionRoles
): readonly [
  ActionDef<
    S,
    {
      readonly kind: 'std.partition';
      readonly from: string;
      readonly to: string;
    },
    object,
    F
  >,
  ActionDef<
    S,
    { readonly kind: 'std.heal'; readonly from: string; readonly to: string },
    object,
    F
  >,
  ActionDef<S, { readonly kind: 'std.healAll' }, object, F>,
] {
  return [stdPartition<S, F>(roles), stdHeal<S, F>(roles), stdHealAll<S, F>()];
}
