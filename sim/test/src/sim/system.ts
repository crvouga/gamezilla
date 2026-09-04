import { defineSystem } from '@pkgs/sim';
import { noErrorBoundary } from '@pkgs/ui-testing/explore';
import { createSim } from '@sim/console/sim/create-sim';

import { maxRuntime } from '../runtime/max-runtime';
import type { ProductExtra } from '../runtime/ports';
import { simRuntime } from '../runtime/sim-runtime';
import { seedSimChessPuzzles } from '../setup/seed-sim-chess-puzzles';
import { anyActor } from './observations';
import { createProductSim, type ProductSim } from './sim';

function extraOf(session: { readonly ports: object }): ProductExtra {
  return session.ports as ProductExtra;
}

/**
 * Product system: one sim (createSim + spawnServer) on the opened session.
 * UI actors spawn lazily via {@link spawnActor}. Hosts are the driver kind:
 * `rntl` (in-process, virtual time) and `playwright` (wall, real Postgres).
 */
export const product = defineSystem<ProductSim>({
  name: 'sim.product',
  async create(session) {
    const extra = extraOf(session);
    const sim = await createSim(session, {
      serverSql: extra.sql,
    });
    // Virtual-time ticks must drain in-process Hono; otherwise UI polls
    // burn their budget while serialized /api/* requests are still queued.
    extra.drainServerHttp.current = () => sim.drainServerFetch();
    await sim.spawnServer();
    await seedSimChessPuzzles({ sqlClient: sim.serverSql.sqlClient });
    return createProductSim(session, sim);
  },
});

product.runtime({ default: true, name: 'rntl', create: () => simRuntime() });
product.runtime({ name: 'playwright', create: () => maxRuntime() });

export const noErrorBoundaryAnyActor = product.property(
  noErrorBoundary(anyActor)
);

export type { ProductSim };
