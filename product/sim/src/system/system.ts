import {
  defineProperty,
  defineRuntime,
  defineSnapshot,
  defineSystem,
} from '@pkgs/sim';
import { projectReportTopology } from '@pkgs/sim-console';
import { noErrorBoundary } from '@pkgs/ui-testing/explore';
import { createSim } from '@product/sim/fabric/create-sim';

import { bunWebviewRuntime } from '../hosts/bun-webview';
import { inProcessRuntime } from '../hosts/in-process';
import type { ProductExtra } from '../hosts/ports';
import { simReportTopology } from '../setup/sim-report-topology';
import {
  partition,
  resetActor,
  restoreNetwork,
  spawnActor,
  uiOp,
} from './actions';
import { anyActor } from './observations';
import { captureSnapshot, devOauthSignIn } from './probes';
import { productScenarioActions } from './scenario-actions';
import { createProductSim, type ProductSim } from './sim';

const FRAME_STYLESHEET_HREF = '../../snapshot-shell.css';

function extraOf(session: { readonly ports: object }): ProductExtra {
  return session.ports as ProductExtra;
}

function canSeedFromNodeFs(): boolean {
  return (
    typeof process !== 'undefined' &&
    typeof process.versions === 'object' &&
    process.versions != null &&
    typeof process.versions.node === 'string'
  );
}

async function maybeSeedSimChessPuzzles(sqlClient: {
  readonly query: unknown;
}): Promise<void> {
  // Playground / Expo web: Node fixtures + `__dirname` are unavailable.
  // Console seeds puzzles via playground command palette instead.
  if (!canSeedFromNodeFs()) return;
  const { seedSimChessPuzzles } = await import(
    '../setup/seed-sim-chess-puzzles'
  );
  await seedSimChessPuzzles({
    sqlClient: sqlClient as import('@pkgs/sql-client/interface').SqlClient,
  });
}

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

export const noErrorBoundaryAnyActor = defineProperty(
  noErrorBoundary(anyActor)
);

/**
 * Product system: one sim (createSim + spawnServer) on the opened session.
 * UI actors spawn lazily via spawnActor. Hosts are registered runtimes:
 * `in-process` (default), `bun-webview`.
 */
export const product = defineSystem<ProductSim>({
  name: 'sim.product',
  runtimes: [
    defineRuntime({
      default: true,
      name: 'in-process',
      create: () => inProcessRuntime(),
    }),
    defineRuntime({
      name: 'bun-webview',
      create: () => bunWebviewRuntime(),
    }),
  ],
  properties: [noErrorBoundaryAnyActor],
  actions: [
    spawnActor,
    resetActor,
    partition,
    restoreNetwork,
    uiOp,
    devOauthSignIn,
    captureSnapshot,
    ...productScenarioActions,
  ],
  snapshots: [
    defineSnapshot({
      name: 'html',
      media: 'html',
      capture: async (s) => captureActorHtml(s),
    }),
    defineSnapshot({
      name: 'topology',
      capture: (s) => projectReportTopology(simReportTopology(s.sim), '1'),
    }),
  ],
  async create(session) {
    const extra = extraOf(session);
    const sim = await createSim(session, {
      serverSql: extra.sql,
    });
    // Virtual-time ticks must drain in-process Hono; otherwise UI polls
    // burn their budget while serialized /api/* requests are still queued.
    extra.drainServerHttp.current = () => sim.drainServerFetch();
    await sim.spawnServer();
    await maybeSeedSimChessPuzzles(sim.serverSql.sqlClient);
    return createProductSim(session, sim);
  },
});

export type { ProductSim };
