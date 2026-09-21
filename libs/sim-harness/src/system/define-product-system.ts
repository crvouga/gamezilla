import { Handles } from '@libs/test-ids';
import {
  defineProperty,
  defineRuntime,
  defineSnapshot,
  defineSystem,
} from '@pkgs/sim';
import type { Driver } from '@pkgs/ui-testing';
import { noErrorBoundary } from '@pkgs/ui-testing/explore';
import type { SimComposition } from '../composition';
import { createSim } from '../fabric/create-sim';

import { inProcessRuntime } from '../hosts/in-process';
import type { ProductExtra, ProductUi } from '../hosts/ports';
import { simReportTopology } from '../setup/sim-report-topology';
import { wireProductRuntime } from '../setup/wire-product-runtime';
import {
  partition,
  resetActor,
  restartApp,
  restoreNetwork,
  spawnActor,
  uiOp,
} from './actions';
import { anyActor } from './observations';
import { PRODUCT_WALK_ACTIONS } from './pool-actions';
import { captureSnapshot, googleOauthSignIn } from './probes';
import { productServerActions } from './server-actions';
import { SHELL_SCENARIO_ACTIONS } from './shell-scenario-actions';
import { createProductSim, type ProductSim, productExtra } from './sim';

function extraOf(session: { readonly ports: object }): ProductExtra {
  return session.ports as ProductExtra;
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

/**
 * Focused UI must expose the global action menu trigger
 * (`Handles.statusCurrentUser`) — including inside an active space on compact.
 *
 * The in-process Solid DOM session parks non-focused actors, so only the
 * active tree is probed.
 * Bun-webview actors each own a window and are all checked.
 */
/** A live browser's next screen may still be loading when a checkpoint lands. */
const WALL_TIME_SETTLE_MS = 30_000;

/**
 * On virtual time the checkpoint runs after the UI has settled, so the menu
 * must be there now; a live browser gets the time a person would wait.
 */
async function menuVisible(
  ui: Driver,
  host: ProductUi['kind']
): Promise<boolean> {
  const menu = ui.get(Handles.statusCurrentUser);
  if (host === 'solid-dom') return await menu.isVisible();
  return await menu.wait('visible', { timeoutMs: WALL_TIME_SETTLE_MS }).then(
    () => true,
    () => false
  );
}

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
      if (!(await menuVisible(handle.ui, extra.ui.kind))) {
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

/** Extra hosts beyond the default `in-process` (the product adds `bun-webview`). */
export type ProductSystemOptions = {
  readonly runtimes?: readonly ReturnType<typeof defineRuntime>[];
};

/**
 * A product system over a composition: one sim on the opened session, booted
 * with a single API instance behind the round-robin load balancer. UI actors
 * spawn lazily via spawnActor; `spawnServerNode` / `dropServerNode` resize the
 * API fleet. The default host is `in-process` (virtual time, happy-dom).
 */
export function defineProductSystem(
  composition: SimComposition,
  options?: ProductSystemOptions
) {
  return defineSystem<ProductSim>({
    name: `sim.${composition.name}`,
    runtimes: [
      defineRuntime({
        default: true,
        name: 'in-process',
        create: () => inProcessRuntime({ composition }),
      }),
      ...(options?.runtimes ?? []),
    ],
    properties: [
      noErrorBoundaryAnyActor,
      globalActionMenuAlwaysVisible,
      ...(composition.properties ?? []),
    ],
    actions: [
      spawnActor,
      resetActor,
      restartApp,
      partition,
      restoreNetwork,
      uiOp,
      googleOauthSignIn,
      captureSnapshot,
      ...productServerActions,
      ...SHELL_SCENARIO_ACTIONS,
      ...PRODUCT_WALK_ACTIONS,
      ...(composition.actions ?? []),
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
        composition,
        serverSql: extra.sql,
      });
      // Virtual-time ticks must drain in-process Hono; otherwise UI polls
      // burn their budget while serialized /api/* requests are still queued.
      extra.drainServerHttp.current = () => sim.drainServerFetch();
      await sim.spawnServer();
      await composition.seedServer?.(sim.serverSql.sqlClient);
      const surface = createProductSim(session, sim);
      // Default actor runtime so `system.explore` / `spawnActor` work without
      // openSim. openSim may replace this with a recording-aware wrapper.
      wireProductRuntime(surface);
      surface.session.onDispose(() => surface.runtime.disposeResources());
      return surface;
    },
  });
}

export type ProductSystem = ReturnType<typeof defineProductSystem>;
export type { ProductSim };
