import { defineSystem } from '@pkgs/dst';
import { noErrorBoundary } from '@pkgs/ui-testing/explore';
import { createSim } from '@sim/console/sim/create-sim';

import { maxHost } from '../host/max-host';
import type { ProductExtra } from '../host/ports';
import { simHost } from '../host/sim-host';
import { seedSimChessPuzzles } from '../setup/seed-sim-chess-puzzles';
import { simNodeTimers } from '../setup/sim-actor-overrides';
import { anyActor } from './observations';
import { createProductSurface, type ProductSurface } from './surface';

function extraOf(session: { readonly ports: object }): ProductExtra {
  return session.ports as ProductExtra;
}

/**
 * Product system: one sim (createSim + spawnServer) on the opened session.
 * UI actors spawn lazily via {@link spawnActor}. Hosts are the driver kind:
 * `rntl` (in-process, virtual time) and `playwright` (wall, real Postgres).
 */
export const product = defineSystem<ProductSurface>({
  name: 'sim.product',
  async create(session) {
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

product.host({ default: true, name: 'rntl', create: () => simHost() });
product.host({ name: 'playwright', create: () => maxHost() });

export const noErrorBoundaryAnyActor = product.property(
  noErrorBoundary(anyActor)
);

export type { ProductSurface };
