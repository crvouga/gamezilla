import { node } from '@pkgs/determinism';
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
    boot: async (ctx) => {
      const sim = await createSim({
        ...createOpts,
        deps: ctx.deps,
      });
      await sim.spawnServer();
      return { sim };
    },
    dispose: async (handle) => {
      await handle.sim.dispose();
    },
  });
}

/** Default node kind (no SQL seed overrides). */
export const productSimNode = createProductSimNode({});
