import { node } from '@pkgs/dst';
import {
  type CreateSimOptions,
  createSim,
  type Sim,
} from '@sim/console/sim/create-sim';

export type ProductSimHandle = {
  readonly sim: Sim;
};

/**
 * Boots {@link createSim} with framework-injected deps, then spawns the Hono
 * server. Actors / RNTL clients stay lazy via openSim.
 */
export function createProductSimNode(createOpts: CreateSimOptions) {
  return node({
    start: async (ctx) => {
      const sim = await createSim({
        ...createOpts,
        deps: ctx.ports,
      });
      await sim.spawnServer();
      return { sim };
    },
    stop: async (handle) => {
      await handle.sim.dispose();
    },
  });
}

/** Default node kind (no SQL seed overrides). */
export const productSimNode = createProductSimNode({});
