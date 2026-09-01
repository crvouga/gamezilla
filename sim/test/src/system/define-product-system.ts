import {
  defineKnob,
  defineSystem,
  type SystemDef,
  type World,
} from '@pkgs/determinism';
import fc from 'fast-check';

import { productSimNode } from './node-kinds';
import {
  createProductSystem,
  type ProductSystem,
  type ProductSystemOpts,
  requireSim,
} from './system';

export type ProductSystemDef = SystemDef<ProductSystem>;
export type ProductSystemWorld = World<ProductSystem>;

export type DefineProductSystemOpts = ProductSystemOpts & {
  readonly id?: string;
};

/**
 * Product `@sim` topology: one `product.sim` (createSim + spawnServer).
 * UI actors spawn lazily via openSim — knob `clientCount` defaults to 0 so
 * topology does not pre-boot clients.
 */
export function defineProductSystem(
  opts?: DefineProductSystemOpts
): ProductSystemDef {
  const { id: systemId, ...createOpts } = opts ?? {};
  return defineSystem<ProductSystem>({
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
    settle: async (world) => {
      requireSim(world.state);
      await world.idle();
    },
    invariants: async () => null,
  });
}

/** Default playground-like boots / registry entry (no SQL seed overrides). */
export const PRODUCT_SYSTEM = defineProductSystem();
