import { createSim } from '@apps/product/sim/fabric/create-sim';
import { Handles } from '@libs/test-ids';
import {
  defineProperty,
  defineRuntime,
  defineSnapshot,
  defineSystem,
} from '@pkgs/sim';
import { projectReportTopology } from '@pkgs/sim-console';
import { noErrorBoundary } from '@pkgs/ui-testing/explore';
import { createSimIds } from '@pkgs/uuid';

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
import { nextPuzzleDifferent } from './chess-properties';
import { anyActor } from './observations';
import { captureSnapshot, devOauthSignIn } from './probes';
import { productScenarioActions } from './scenario-actions';
import { createProductSim, type ProductSim, productExtra } from './sim';

export { nextPuzzleDifferent } from './chess-properties';

const FRAME_STYLESHEET_HREF = '../../snapshot-shell.css';

function extraOf(session: { readonly ports: object }): ProductExtra {
  return session.ports as ProductExtra;
}

function canSeedFromNodeFs(): boolean {
  if (typeof process === 'undefined') return false;
  // Browser `process` shims may omit `versions`; widen past the Node typings.
  const shim: { readonly versions?: { readonly node?: unknown } } = process;
  return typeof shim.versions?.node === 'string';
}

/** Fixed seed clock / id namespace so web dumps stay byte-stable. */
const SIM_CHESS_WEB_SEED_NOW_MS = 1_700_000_000_000;

/**
 * Every sim host boots with puzzles so the chess surface is playable without
 * a manual seed step. Node hosts load the tiny DST CSV (3 documented puzzles
 * the scenario tests exhaust on purpose); the web host (product-simulator /
 * `bun run dev`) inserts the inline 50-row fixture.
 */
async function seedSimChessPuzzles(sqlClient: {
  readonly query: unknown;
}): Promise<void> {
  const typed = sqlClient as import('@pkgs/sql-client/interface').SqlClient;
  if (canSeedFromNodeFs()) {
    const { seedSimChessPuzzles: seedFromNodeFs } = await import(
      '../setup/seed-sim-chess-puzzles'
    );
    await seedFromNodeFs({ sqlClient: typed });
    return;
  }
  const { seedSimChessPuzzlesWeb } = await import(
    '../setup/seed-sim-chess-puzzles-web'
  );
  const ids = createSimIds('sim-chess-puzzle-seed-web');
  await seedSimChessPuzzlesWeb({
    sqlClient: typed,
    now: () => SIM_CHESS_WEB_SEED_NOW_MS,
    createId: ids.createId,
  });
}

async function captureActorHtml(
  s: ProductSim
): Promise<Record<string, string> | null> {
  const extra = extraOf(s.session);
  if (extra.ui.kind === 'solid-dom' && extra.ui.session !== undefined) {
    const snapshots = await extra.ui.session.snapshotAllActors({
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
 * Focused UI must expose the global action menu trigger
 * (`Handles.statusCurrentUser`) — including inside an active space on compact.
 *
 * The in-process Solid DOM session parks non-focused actors, so only the
 * active tree is probed.
 * Bun-webview actors each own a window and are all checked.
 */
export const globalActionMenuAlwaysVisible = defineProperty({
  name: 'globalActionMenuAlwaysVisible',
  check: async (s: ProductSim) => {
    const extra = productExtra(s);
    const activeId =
      extra.ui.kind === 'solid-dom'
        ? extra.ui.session?.activeActorId()
        : undefined;
    const missing: string[] = [];
    for (const [id, handle] of s.actors) {
      if (activeId !== undefined && id !== activeId) continue;
      if (!(await handle.ui.get(Handles.statusCurrentUser).isVisible())) {
        missing.push(id);
      }
    }
    if (missing.length > 0) {
      throw new Error(
        `global action menu not visible for actor(s): ${missing.join(', ')}`
      );
    }
  },
});

/**
 * People search must not leave the focused actor on an eternal "Searching…"
 * spinner after the run has drained timers + in-process HTTP.
 */
export const searchDoesNotHang = defineProperty({
  name: 'searchDoesNotHang',
  check: async (s: ProductSim) => {
    const extra = productExtra(s);
    const activeId =
      extra.ui.kind === 'solid-dom'
        ? extra.ui.session?.activeActorId()
        : undefined;
    for (const [id, handle] of s.actors) {
      if (activeId !== undefined && id !== activeId) continue;
      const loading = handle.ui.get(Handles.searchLoading);
      if (!(await loading.isVisible())) continue;
      await loading.expect.hidden({
        timeoutMs: 10_000,
        description: `search settle for actor ${id}`,
      });
    }
  },
});

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
  properties: [
    noErrorBoundaryAnyActor,
    globalActionMenuAlwaysVisible,
    searchDoesNotHang,
    nextPuzzleDifferent,
  ],
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
    await seedSimChessPuzzles(sim.serverSql.sqlClient);
    return createProductSim(session, sim);
  },
});

export type { ProductSim };
