import { defineProperty } from '@pkgs/harness-root-shared-ts/define-property';
import { defineRuntime } from '@pkgs/harness-root-shared-ts/define-runtime';
import { defineSystem } from '@pkgs/harness-root-shared-ts/define-system';
import type { Driver } from '@pkgs/ui-testing-root-shared-ts/driver';
import { noErrorBoundary } from '@pkgs/ui-testing-root-shared-ts/observations';
import {
  partition,
  resetActor,
  restartApp,
  restoreActorConnection,
  restoreNetwork,
  spawnActor,
  uiOp,
} from './actions';
import { describeWhereabouts } from './actor-whereabouts';
import { bunWebviewRuntime } from './bun-webview';
import type { HarnessComposition } from './composition';
import { type CreateHarnessOptions, createHarness } from './create-harness';
import { expectShellShown, shellShown } from './driver-gestures';
import type { ProductHarness } from './harness';
import { createProductHarness, productExtra } from './harness';
import { inProcessRuntime } from './in-process';
import { anyActor } from './observations';
import type { ProductExtra, ProductUi } from './ports';
import { captureSnapshot } from './probes';
import { atConfiguredGoogleHandoff } from './provider-handoff';
import { productServerActions } from './server-actions';
import { SHELL_SCENARIO_ACTIONS } from './shell-scenario-actions';
import { wireProductRuntime } from './wire-product-runtime';

function extraOf(session: { readonly ports: object }): ProductExtra {
  return session.ports as ProductExtra;
}

export const noErrorBoundaryAnyActor = defineProperty(
  noErrorBoundary(anyActor)
);

/**
 * Focused UI must expose the global action menu trigger
 * (`Handles.statusCurrentUser`), except inside an open space: a space's top
 * bar is the space's alone, and its back button leads out to the menu.
 *
 * The in-process Solid DOM session parks non-focused actors, so only the
 * active tree is probed.
 * Bun-webview actors each own a window and are all checked.
 */
/** A live browser's next screen may still be loading when a checkpoint lands. */
const WALL_TIME_SETTLE_MS = 30_000;

/**
 * On virtual time the checkpoint runs after the UI has settled, so the app's
 * chrome must be there now; a live browser gets the time a person would wait.
 */
async function chromeVisible(
  ui: Driver,
  host: ProductUi['kind']
): Promise<boolean> {
  if (host === 'solid-dom') return await shellShown(ui);
  return await expectShellShown(ui, WALL_TIME_SETTLE_MS).then(
    () => true,
    () => false
  );
}

export const globalActionMenuAlwaysVisible = defineProperty({
  name: 'globalActionMenuAlwaysVisible',
  check: async (s: ProductHarness) => {
    const extra = productExtra(s);
    const activeId =
      extra.ui.kind === 'solid-dom'
        ? extra.ui.session?.activeActorId()
        : undefined;
    const missing: string[] = [];
    const places: string[] = [];
    for (const [id, handle] of s.actors) {
      if (activeId !== undefined && id !== activeId) continue;
      const handoff = () =>
        atConfiguredGoogleHandoff(handle.browser, extra.http);
      if (await handoff()) continue;
      if (
        !(await chromeVisible(handle.ui, extra.ui.kind)) &&
        !(await handoff())
      ) {
        missing.push(id);
        places.push(
          `${id} at ${await describeWhereabouts({
            browser: handle.browser,
            appOrigin:
              extra.http.kind === 'in-process'
                ? null
                : new URL(extra.http.origin).origin,
            html: () => handle.ui.snapshotHtml(),
          })}`
        );
      }
    }
    if (missing.length > 0) {
      throw new Error(
        `global action menu not visible for actor(s): ${missing.join(', ')} — ${places.join('; ')}`
      );
    }
  },
});

/**
 * A product system over a composition: one harness on the opened session, booted
 * with a single API instance behind the round-robin load balancer. UI actors
 * spawn lazily via spawnActor; `spawnServerNode` / `dropServerNode` resize the
 * API fleet. The default host is `in-process` (virtual time, happy-dom);
 * `bun-webview` (a live browser, `HARNESS_MODE=real|stack`) runs the same suite.
 */
export function defineProductSystem(
  composition: HarnessComposition,
  options: Pick<CreateHarnessOptions, 'secretValues' | 'sharedDataStore'> = {}
) {
  return defineSystem<ProductHarness>({
    name: `harness.${composition.name}`,
    runtimes: [
      defineRuntime({
        default: true,
        name: 'in-process',
        create: () => inProcessRuntime({ composition }),
      }),
      defineRuntime({
        name: 'bun-webview',
        create: () => bunWebviewRuntime({ composition }),
      }),
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
      restoreActorConnection,
      uiOp,
      captureSnapshot,
      ...productServerActions,
      ...SHELL_SCENARIO_ACTIONS,
      ...(composition.actions ?? []),
    ],
    async create(session) {
      const extra = extraOf(session);
      const harness = await createHarness(session, {
        ...options,
        composition,
        serverSql: extra.sql,
        clientConfigOwner:
          extra.http.kind === 'stack' ? 'external' : 'this-server',
        ...(extra.serverRooms === undefined
          ? {}
          : { serverRooms: extra.serverRooms }),
        ...(extra.serverEvents === undefined
          ? {}
          : { serverEvents: extra.serverEvents }),
      });
      // Virtual-time ticks must drain in-process Hono; otherwise UI polls
      // burn their budget while serialized /api/* requests are still queued.
      extra.drainServerHttp.current = () => harness.drainServerFetch();
      await harness.spawnServer();
      await composition.seedServer?.(harness.serverSql.sqlClient);
      const surface = createProductHarness(session, harness);
      await composition.beforeScenario?.(surface);
      // Default actor runtime so `system.explore` / `spawnActor` work without
      // openHarness. openHarness replaces it to add snapshot restore and teardown.
      wireProductRuntime(surface);
      surface.session.onDispose(() => surface.runtime.disposeResources());
      return surface;
    },
  });
}

export type ProductSystem = ReturnType<typeof defineProductSystem>;
