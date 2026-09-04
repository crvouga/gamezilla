import { defineSystem } from '@pkgs/sim';
import { projectReportTopology } from '@pkgs/sim-console';
import { noErrorBoundary } from '@pkgs/ui-testing/explore';
import { createSim } from '@product/sim/fabric/create-sim';

import { bunWebviewRuntime } from '../hosts/bun-webview';
import { inProcessRuntime } from '../hosts/in-process';
import type { ProductExtra } from '../hosts/ports';
import { playwrightRuntime } from '../hosts/playwright';
import { seedSimChessPuzzles } from '../setup/seed-sim-chess-puzzles';
import { simReportTopology } from '../setup/sim-report-topology';
import { anyActor } from './observations';
import { createProductSim, type ProductSim } from './sim';

const FRAME_STYLESHEET_HREF = '../../snapshot-shell.css';

function extraOf(session: { readonly ports: object }): ProductExtra {
  return session.ports as ProductExtra;
}

/**
 * Product system: one sim (createSim + spawnServer) on the opened session.
 * UI actors spawn lazily via spawnActor. Hosts are registered runtimes:
 * `in-process` (default), `bun-webview`, `playwright`.
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

product.runtime({
  default: true,
  name: 'in-process',
  create: () => inProcessRuntime(),
});
product.runtime({ name: 'bun-webview', create: () => bunWebviewRuntime() });
product.runtime({ name: 'playwright', create: () => playwrightRuntime() });

product.snapshot({
  name: 'html',
  media: 'html',
  capture: async (s) => captureActorHtml(s),
});

product.snapshot({
  name: 'topology',
  capture: (s) => projectReportTopology(simReportTopology(s.sim), '1'),
});

export const noErrorBoundaryAnyActor = product.property(
  noErrorBoundary(anyActor)
);

async function captureActorHtml(
  s: ProductSim
): Promise<Record<string, string> | null> {
  const extra = extraOf(s.session);
  if (extra.ui.kind === 'react-tree' && extra.ui.rntl !== undefined) {
    const snapshots = await extra.ui.rntl.snapshotAllActors({
      stylesheetHref: FRAME_STYLESHEET_HREF,
    });
    if (snapshots.size === 0) return null;
    return Object.fromEntries(snapshots.entries());
  }
  const map: Record<string, string> = {};
  for (const [id, handle] of s.actors) {
    const html = await handle.ui.snapshotHtml();
    if (html != null && html.trim() !== '') map[id] = html;
  }
  return Object.keys(map).length > 0 ? map : null;
}

export type { ProductSim };
