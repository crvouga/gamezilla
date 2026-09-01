import {
  defineKnob,
  defineSystem,
  type SystemDef,
  type World,
} from '@pkgs/determinism';
import type { Sim } from '@sim/console/sim/create-sim';
import fc from 'fast-check';

import { productSimNode } from './node-kinds';
import {
  createProductSystem,
  type ProductSystem,
  type ProductSystemOpts,
} from './system';

export type ProductSystemDef = SystemDef<ProductSystem, object, Sim>;
export type ProductSystemWorld = World<ProductSystem, Sim>;

export type DefineProductSystemOpts = ProductSystemOpts & {
  readonly id?: string;
};

/**
 * Product `@sim` topology: one `product.sim` (createSim + spawnServer).
 * UI actors spawn lazily via openSim — knob `clientCount` defaults to 0 so
 * topology does not pre-boot clients. Live sim is `world.facade`.
 */
export function defineProductSystem(
  opts?: DefineProductSystemOpts
): ProductSystemDef {
  const { id: systemId, ...createOpts } = opts ?? {};
  return defineSystem<ProductSystem, object, Sim>({
    id: systemId ?? 'sim.product',
    ...(createOpts.startMs !== undefined
      ? { startMs: createOpts.startMs }
      : {}),
    knobs: [
      defineKnob({
        id: 'clientCount',
        default: 0,
        arb: fc.constant(0),
      }),
    ],
    nodes: [{ kind: productSimNode, role: 'sim', count: 1 }],
    state: () => createProductSystem(createOpts),
    actions: [],
    facade: (world) => {
      const sim = world.state.sim;
      if (sim === null) {
        throw new Error('product system: product.sim has not booted');
      }
      return sim;
    },
    settle: async (world) => {
      void world.facade;
      await world.idle();
    },
    invariants: async () => null,
  });
}

/** Default playground-like boots / registry entry (no SQL seed overrides). */
export const PRODUCT_SYSTEM = defineProductSystem();
