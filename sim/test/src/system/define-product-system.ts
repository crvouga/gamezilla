import {
  type SystemDef,
  type World,
  defineSystem,
  defineSystemKnob,
} from '@pkgs/determinism';
import fc from 'fast-check';

import './node-kinds';
import { PRODUCT_SIM, PRODUCT_WARMUP } from './node-kinds';
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
 * Product `@sim` topology: one `product.sim` (createSim + spawnServer) plus a
 * no-op warmup. UI actors spawn lazily via openSim — knob `clientCount`
 * defaults to 0 so topology does not pre-boot clients.
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
      defineSystemKnob<number>({
        id: 'clientCount',
        default: 0,
        arb: fc.constant(0),
      }),
    ],
    nodes: [
      { kind: PRODUCT_SIM, role: 'sim', count: 1 },
      { kind: PRODUCT_WARMUP, role: 'warmup', count: 1 },
    ],
    system: () => createProductSystem(createOpts),
    settle: async (world) => {
      requireSim(world.system);
      await world.runUntilIdle();
    },
  });
}

/** Default playground-like boots / registry entry (no SQL seed overrides). */
export const PRODUCT_SYSTEM = defineProductSystem();
