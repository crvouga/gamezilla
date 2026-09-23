import { createSim } from '@apps/product/sim/fabric/create-sim';
import { Handles } from '@libs/test-ids';
import {
  defineProperty,
  defineRuntime,
  defineSnapshot,
  defineSystem,
} from '@pkgs/sim';
import { noErrorBoundary } from '@pkgs/ui-testing/explore';
import { createSimIds } from '@pkgs/uuid';
import { inProcessRuntime } from '../hosts/in-process';
import { localhostRuntime } from '../hosts/localhost';
import type { ProductExtra } from '../hosts/ports';
import { simReportTopology } from '../setup/sim-report-topology';
import { wireProductRuntime } from '../setup/wire-product-runtime';
import {
  partition,
  resetActor,
  restoreNetwork,
  spawnActor,
  uiOp,
} from './actions';
import { nextPuzzleDifferent } from './chess-properties';
import { anyActor } from './observations';
import { PRODUCT_WALK_ACTIONS } from './pool-actions';
import { captureSnapshot, devOauthSignIn } from './probes';
import { productScenarioActions } from './scenario-actions';
import { productServerActions } from './server-actions';
import {
  createProductSim,
  type ProductSim,
  productExtra,
  type SimActor,
} from './sim';

export { nextPuzzleDifferent } from './chess-properties';

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
 * `bun start:in-process`) inserts the inline 50-row fixture.
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
    const snapshots = await extra.ui.session.snapshotAllActors();
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

/** Wall-clock actors may be mid boot canvas (identity / database swap). */
const WALL_MENU_SETTLE_MS = 10_000;

async function menuVisible(
  s: ProductSim,
  id: string,
  ui: SimActor['ui']
): Promise<boolean> {
  const menu = ui.get(Handles.statusCurrentUser);
  if (await menu.isVisible()) return true;
  if (productExtra(s).ui.kind !== 'bun-webview') return false;
  try {
    await menu.expect.visible({
      timeoutMs: WALL_MENU_SETTLE_MS,
      description: `global action menu for actor ${id}`,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Focused UI must expose the global action menu trigger
 * (`Handles.statusCurrentUser`) — including inside an active space on compact.
 *
 * The in-process Solid DOM session parks non-focused actors, so only the
 * active tree is probed; virtual time has already drained, so a snapshot
 * read is the verdict. Bun-webview actors each own a window and are all
 * checked; on wall time a transient boot canvas gets time to settle.
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
      if (!(await menuVisible(s, id, handle.ui))) missing.push(id);
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
 * Product system: one sim on the opened session, booted with a single API
 * instance behind the round-robin load balancer. UI actors spawn lazily via
 * spawnActor; `spawnServerNode` / `dropServerNode` resize the API fleet.
 * Profiles are registered runtimes: `in-process` (default),
 * `localhost:mocked`, and `localhost` (the full system under `bun e2e`).
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
      name: 'localhost:mocked',
      create: () => localhostRuntime('localhost:mocked'),
    }),
    defineRuntime({
      name: 'localhost',
      create: () => localhostRuntime('localhost'),
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
    ...productServerActions,
    ...productScenarioActions,
    ...PRODUCT_WALK_ACTIONS,
  ],
  snapshots: [
    defineSnapshot({
      name: 'html',
      media: 'html',
      capture: async (s) => captureActorHtml(s),
    }),
    defineSnapshot({
      name: 'topology',
      capture: (s) => simReportTopology(s),
    }),
  ],
  async create(session) {
    const extra = extraOf(session);
    const sim = await createSim(session, {
      serverSql: extra.sql,
      ...(extra.http.kind === 'localhost'
        ? {
            serverUrl:
              extra.ui.kind === 'bun-webview'
                ? extra.ui.webOrigin
                : extra.http.origin,
          }
        : {}),
    });
    // Virtual-time ticks must drain in-process Hono; otherwise UI polls
    // burn their budget while serialized /api/* requests are still queued.
    extra.drainServerHttp.current = () => sim.drainServerFetch();
    // The full stack serves the API from the real Worker; the in-process
    // fleet stays empty and the sim only holds the harness SQL handle.
    if (extra.http.kind !== 'full-stack') await sim.spawnServer();
    await seedSimChessPuzzles(sim.serverSql.sqlClient);
    const surface = createProductSim(session, sim);
    // Default actor runtime so `system.explore` / `spawnActor` work without
    // openSim. openSim may replace this with a recording-aware wrapper.
    wireProductRuntime(surface);
    surface.session.onDispose(() => surface.runtime.disposeResources());
    return surface;
  },
});

export type { ProductSim };
