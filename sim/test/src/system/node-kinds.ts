import { defineNodeKind } from '@pkgs/determinism';
import { createSim, type Sim } from '@sim/console/sim/create-sim';

import type { ProductSystem } from './system';

type ProductSimHandle = {
  readonly sim: Sim;
};

/**
 * Boots {@link createSim} with framework-injected deps, then spawns the Hono
 * server. Actors / RNTL clients stay lazy via openSim.
 */
export const productSimNode = defineNodeKind<
  ProductSimHandle,
  ProductSimHandle,
  ProductSystem
>({
  id: 'product.sim',
  boot: async (ctx) => {
    const { createOpts } = ctx.state;
    const sim = await createSim({
      ...createOpts,
      deps: ctx.deps,
    });
    await sim.spawnServer();
    ctx.state.sim = sim;
    return { sim };
  },
  dispose: async (handle) => {
    await handle.sim.dispose();
  },
  view: (h) => h,
});
