import type { CreateSimOptions, Sim } from '@sim/console/sim/create-sim';

/**
 * Mutable bag shared by `product.*` node kinds. Filled during boot; scenarios
 * reach the live sim via {@link requireSim}.
 */
export type ProductSystem = {
  sim: Sim | null;
  readonly createOpts: CreateSimOptions;
};

export type ProductSystemOpts = CreateSimOptions;

export function createProductSystem(opts?: ProductSystemOpts): ProductSystem {
  return {
    sim: null,
    createOpts: opts ?? {},
  };
}

export function productSim(system: ProductSystem): Sim | null {
  return system.sim;
}

export function requireSim(system: ProductSystem): Sim {
  if (system.sim === null) {
    throw new Error('product system: product.sim has not booted');
  }
  return system.sim;
}
