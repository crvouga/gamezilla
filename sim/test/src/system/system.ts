import type { CreateSimOptions, Sim } from '@sim/console/sim/create-sim';

/**
 * Mutable bag shared by `product.*` node kinds. Filled during boot; scenarios
 * reach the live sim via framework `world.facade`.
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

export function productSim(state: ProductSystem): Sim | null {
  return state.sim;
}
