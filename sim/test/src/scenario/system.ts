import { defineSystem } from '@pkgs/dst';
import { createSim } from '@sim/console/sim/create-sim';

import type { ProductExtra } from '../host/ports';
import { seedSimChessPuzzles } from '../setup/seed-sim-chess-puzzles';
import { simNodeTimers } from '../setup/sim-actor-overrides';
import { createProductSurface, type ProductSurface } from './surface';

function extraOf(session: { readonly ports: object }): ProductExtra {
  return session.ports as ProductExtra;
}

/**
 * Product system: one sim (createSim + spawnServer) on the opened session.
 * UI actors spawn lazily via {@link spawnActor}.
 */
export const product = defineSystem({
  name: 'sim.product',
  async generate(session): Promise<ProductSurface> {
    const extra = extraOf(session);
    const sim = await createSim(session, {
      serverSql: extra.sql,
      ...(extra.ui.kind === 'rntl' ? { timers: simNodeTimers } : {}),
    });
    await sim.spawnServer();
    await seedSimChessPuzzles({ sqlClient: sim.serverSql.sqlClient });
    return createProductSurface(session, sim);
  },
});

const { defineObservation, defineAction } = product;

export type { ProductSurface };
export { defineAction, defineObservation };
