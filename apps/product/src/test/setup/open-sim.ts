/**
 * Open a product UI simulation: `product.run` on a registered host
 * (`in-process` / `bun-webview`).
 */

import type {
  ProductExtra,
  ProductHostName,
  ProductRuntime,
  ProductSim,
  ProductUi,
  Sim,
  SimActor,
  SimHttpListener,
  SimSql,
} from '@apps/product/sim';
import {
  listenSimHttpServer,
  product,
  productExtra,
  restoreSystemSnapshot,
  type SystemSnapshotCtx,
} from '@apps/product/sim';
import { wallClock } from '@pkgs/clock';
import type { Run } from '@pkgs/sim';
import { defineAction } from '@pkgs/sim';
import type { SimSystemSnapshot } from '@pkgs/sim-console/shared/sim-system-snapshot';

import {
  type ActorEntry,
  closeActorEntry,
  getReportStore,
  launchActor as launchActorEntry,
  prepareReportStore,
  STATIC_REPORT_RUN_ID,
  simReportEnabled,
  writeKeysIndex,
} from './launch-actor';
import { type OpenSimOptions, resolveSimMode, type SimMode } from './mode';
import { ensureNodeLocalStoragePolyfill } from './node-local-storage-polyfill';
import { simNodeTimers } from './sim-actor-overrides';
import { readSimSystemSnapshot } from './sim-snapshot-fixture';

export type { SimActor };
export type OpenSim = Run<ProductSim>;

function resolveHostName(options: OpenSimOptions | undefined): ProductHostName {
  return resolveSimMode(options) === 'real' ? 'bun-webview' : 'in-process';
}

type WiredRuntime = {
  readonly entries: Map<string, ActorEntry>;
  httpListener: SimHttpListener | null;
};

function domSessionOf(ui: ProductUi) {
  return ui.kind === 'solid-dom' ? (ui.session ?? null) : null;
}

function makeRuntime(args: {
  readonly surface: ProductSim;
  readonly extra: ProductExtra;
  readonly snapshot: SimSystemSnapshot | undefined;
  readonly wired: WiredRuntime;
}): ProductRuntime {
  const { surface, extra, snapshot, wired } = args;
  return {
    async launchActor(id) {
      const entry = await launchActorEntry({
        ui: extra.ui,
        sim: surface.sim,
        id,
        ...(snapshot !== undefined ? { snapshot } : {}),
      });
      wired.entries.set(id, entry);
      return entry.handle;
    },
    async resetActor(id) {
      const existing = wired.entries.get(id);
      if (existing !== undefined) {
        await closeActorEntry(existing);
        wired.entries.delete(id);
      }
      surface.actors.delete(id);
      await surface.sim.dropClient(id);
      surface.sim.bumpClientEpoch();
    },
    async disposeResources() {
      await disposeProduct(surface.sim, extra, wired);
    },
  };
}

async function disposeProduct(
  sim: Sim,
  extra: ProductExtra,
  wired: WiredRuntime
): Promise<void> {
  for (const a of wired.entries.values()) {
    await closeActorEntry(a);
  }
  wired.entries.clear();
  domSessionOf(extra.ui)?.dispose();
  if (wired.httpListener !== null) {
    await wired.httpListener.stop();
  }
  if (simReportEnabled()) {
    try {
      await writeKeysIndex();
    } catch (err) {
      console.error(
        '[openSim] report keys index failed:',
        err instanceof Error ? err.message : err
      );
    }
  }
  await sim.dispose();
  await new Promise<void>((resolve) => {
    simNodeTimers.setTimeout(resolve, 50);
  });
}

async function restoreSnapshot(
  sim: Sim,
  snapshot: SimSystemSnapshot
): Promise<void> {
  const clientSqlByAddress = new Map<string, SimSql>();
  const liveClients = new Map<string, ReturnType<Sim['spawnClient']>>();
  const snapshotCtx: SystemSnapshotCtx = {
    sim,
    clientIds: snapshot.clientIds,
    liveClients,
    clientSqlByAddress,
  };
  await restoreSystemSnapshot(snapshotCtx, snapshot);
}

async function wireSim(args: {
  readonly surface: ProductSim;
  readonly snapshot?: SimSystemSnapshot;
}): Promise<void> {
  const { surface } = args;
  const extra = productExtra(surface);
  if (args.snapshot !== undefined) {
    await restoreSnapshot(surface.sim, args.snapshot);
  }
  const wired: WiredRuntime = {
    entries: new Map(),
    httpListener: null,
  };
  if (extra.http.kind === 'localhost') {
    wired.httpListener = await listenSimHttpServer(surface.sim);
  }
  surface.runtime = makeRuntime({
    surface,
    extra,
    snapshot: args.snapshot,
    wired,
  });
}

/**
 * Pin the surface for setup wiring only. `Run` is the sole public handle —
 * scenarios never see this, and nothing outside this module may call it.
 */
async function pinSim(s: Run<ProductSim>): Promise<ProductSim> {
  const pin: { current: ProductSim | null } = { current: null };
  const capture = defineAction({
    name: 'openSim.pinSim',
    act: (s: ProductSim) => {
      pin.current = s;
    },
  });
  await s.apply(capture);
  if (pin.current === null) {
    throw new Error('openSim: surface pin did not run');
  }
  return pin.current;
}

export async function openSim(
  testId: string,
  options?: OpenSimOptions
): Promise<OpenSim> {
  ensureNodeLocalStoragePolyfill();
  const mode = resolveSimMode(options);
  if (mode === 'real') {
    process.env['SIM_MODE'] = 'real';
  }
  if (simReportEnabled()) {
    await prepareReportStore();
  }
  const s = await product.run({
    seed: 1,
    runtime: resolveHostName(options),
    ...(simReportEnabled()
      ? {
          report: {
            store: getReportStore(),
            runId: STATIC_REPORT_RUN_ID,
            testId,
            now: () => wallClock.now(),
          },
        }
      : {}),
  });
  const surface = await pinSim(s);
  const snapshot =
    options?.snapshot !== undefined
      ? readSimSystemSnapshot(options.snapshot)
      : undefined;
  await wireSim({
    surface,
    ...(snapshot !== undefined ? { snapshot } : {}),
  });
  surface.session.onDispose(() => surface.runtime.disposeResources());
  return s;
}

export type { OpenSimOptions, SimMode };
