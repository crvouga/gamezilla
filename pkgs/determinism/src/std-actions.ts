import fc from 'fast-check';
import type { ActionArbContext, ActionDef } from './action';
import type { SystemAction } from './define-system';
import type { World } from './world-types';

export type StdPartitionRoles = {
  readonly fromRole: string;
  readonly toRole: string;
};

/**
 * Partition one random node of `fromRole` from one random node of `toRole`
 * (by node id — World expands to endpoint pairs).
 */
export function stdPartition<S>(
  roles: StdPartitionRoles
): ActionDef<
  S,
  { readonly kind: 'std.partition'; readonly from: string; readonly to: string }
> {
  return {
    kind: 'std.partition',
    class: 'library',
    arb: (ctx: ActionArbContext) => {
      const fromIds = ctx.roleIds(roles.fromRole);
      const toIds = ctx.roleIds(roles.toRole);
      if (fromIds.length === 0 || toIds.length === 0) {
        return fc.constant({
          kind: 'std.partition' as const,
          from: fromIds[0] ?? roles.fromRole,
          to: toIds[0] ?? roles.toRole,
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
export function stdHeal<S>(
  roles: StdPartitionRoles
): ActionDef<
  S,
  { readonly kind: 'std.heal'; readonly from: string; readonly to: string }
> {
  return {
    kind: 'std.heal',
    class: 'library',
    arb: (ctx: ActionArbContext) => {
      const fromIds = ctx.roleIds(roles.fromRole);
      const toIds = ctx.roleIds(roles.toRole);
      if (fromIds.length === 0 || toIds.length === 0) {
        return fc.constant({
          kind: 'std.heal' as const,
          from: fromIds[0] ?? roles.fromRole,
          to: toIds[0] ?? roles.toRole,
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

export function stdHealAll<S>(): ActionDef<
  S,
  { readonly kind: 'std.healAll' }
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

export function stdAdvance<S>(
  opts?: StdAdvanceOpts
): ActionDef<S, { readonly kind: 'std.advance'; readonly ms: number }> {
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
    dispatch: async (world: World<S>, action) => {
      await world.advance(action.ms);
    },
  };
}

/** Bundle of common chaos actions for a directed role pair. */
export function stdNetChaos<S>(
  roles: StdPartitionRoles
): readonly ActionDef<S, SystemAction>[] {
  return [
    stdPartition<S>(roles) as unknown as ActionDef<S, SystemAction>,
    stdHeal<S>(roles) as unknown as ActionDef<S, SystemAction>,
    stdHealAll<S>() as unknown as ActionDef<S, SystemAction>,
  ];
}
