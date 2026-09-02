import {
  type ActionCatalog,
  defineScenario,
  knob,
  properties,
  property,
  type ScenarioDef,
  std,
} from '@pkgs/dst';
import type { Sim } from '@sim/console/sim/create-sim';
import fc from 'fast-check';

import { createProductSimNode, type ProductSimHandle } from './node-kinds';
import type { ProductSystemOpts } from './system';

const CLIENT_COUNT = knob(0, fc.constant(0));

const PRODUCT_KNOBS = { clientCount: CLIENT_COUNT } as const;

type ProductKnobs = typeof PRODUCT_KNOBS;

type ProductNodes = {
  readonly sim: ReturnType<typeof createProductSimNode>;
};

export type ProductSimExtension = { readonly sim: Sim };

export type ProductSurface = ProductSimExtension;

export type ProductSystemDef = ScenarioDef<
  ProductKnobs,
  ProductNodes,
  ProductSurface,
  ProductSurface
>;

export type ProductSystemWorld = import('@pkgs/dst').World<
  ProductKnobs,
  ProductNodes,
  ProductSurface
>;

export type DefineProductSystemOpts = ProductSystemOpts & {
  readonly id?: string;
};

/**
 * Product `@sim` topology: one `product.sim` (createSim + spawnServer).
 * UI actors spawn lazily via openSim — knob `clientCount` defaults to 0 so
 * topology does not pre-boot clients. Live sim is `world.sim`.
 */
export function defineProductSystem(
  opts?: DefineProductSystemOpts
): ProductSystemDef {
  const { id: systemId, ...createOpts } = opts ?? {};
  const simNode = createProductSimNode(createOpts);
  return defineScenario({
    id: systemId ?? 'sim.product',
    ...(createOpts.startTime !== undefined
      ? { startTime: createOpts.startTime }
      : {}),
    knobs: PRODUCT_KNOBS,
    nodes: { sim: simNode },
    actions: std.time() as unknown as ActionCatalog<ProductSurface>,
    extend: (world) => {
      const handle = world.nodes.sim as ProductSimHandle;
      return { sim: handle.sim };
    },
    properties: properties<ProductSurface>()({
      converged: property.always(async () => true, { at: 'converge' }),
    }),
    converge: async (world) => {
      void world.sim;
      await world.quiesce();
    },
  });
}

/** Default playground-like boots / registry entry (no SQL seed overrides). */
export const PRODUCT_SYSTEM = defineProductSystem();
