import { defineNodeKind } from '@pkgs/determinism';
import { createSim, type Sim } from '@sim/console/sim/create-sim';

import { type ProductSystem, requireSim } from './system';

export const PRODUCT_SIM = 'product.sim';
export const PRODUCT_WARMUP = 'product.warmup';

type ProductSimHandle = {
  readonly sim: Sim;
};

/**
 * Boots {@link createSim} with framework-injected deps, then spawns the Hono
 * server. Actors / RNTL clients stay lazy via openSim.
 */
defineNodeKind<ProductSimHandle, unknown, ProductSystem>({
  id: PRODUCT_SIM,
  boot: async (ctx) => {
    const { createOpts } = ctx.system;
    const sim = await createSim({
      ...createOpts,
      deps: ctx.deps,
    });
    await sim.spawnServer();
    ctx.system.sim = sim;
    return { sim };
  },
  dispose: async (handle) => {
    await handle.sim.dispose();
  },
});

/** Post-boot settle hook; openSim drives actors outside the topology. */
defineNodeKind<{ readonly id: string }, unknown, ProductSystem>({
  id: PRODUCT_WARMUP,
  boot: async (ctx) => {
    requireSim(ctx.system);
    return { id: ctx.nodeId };
  },
});
