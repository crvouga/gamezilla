/**
 * Open a product UI simulation: `product.run` on a registered host
 * (`in-process` / `bun-webview`).
 */

import type {
  ProductExtra,
  ProductHostName,
  ProductSim,
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

import { wireProductRuntime } from '../../sim/setup/wire-product-runtime';
import {
  isLiveBrowserMode,
  type OpenSimOptions,
  resolveSimMode,
  type SimMode,
} from './mode';
import {
  clearNodeLocalStoragePolyfill,
  ensureNodeLocalStoragePolyfill,
} from './node-local-storage-polyfill';
import { simNodeTimers } from './sim-actor-overrides';
import {
  getReportStore,
  SIM_REPORT_RUN_ID,
  simReportEnabled,
  testCallSite,
} from './sim-report';
import { readSimSystemSnapshot } from './sim-snapshot-fixture';

export type { SimActor };
export type OpenSim = Run<ProductSim>;

function resolveHostName(options: OpenSimOptions | undefined): ProductHostName {
  return isLiveBrowserMode(resolveSimMode(options))
    ? 'bun-webview'
    : 'in-process';
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

/**
 * Pin the surface for setup wiring only. `Run` is the sole public handle —
 * scenarios never see this, and nothing outside this module may call it.
 */
async function pinSim(s: Run<ProductSim>): Promise<ProductSim> {
  const pin: { current: ProductSim | null } = { current: null };
  const capture = defineAction({
    name: 'openSim.pinSim',
    report: false,
    act: (surf: ProductSim) => {
      pin.current = surf;
    },
  });
  await s.apply(capture);
  if (pin.current === null) {
    throw new Error('openSim: surface pin did not run');
  }
  return pin.current;
}

/**
 * Open a reported product sim. The report bucket is `.cache/sim-report`;
 * `bun run --filter @apps/product test:report` builds the standalone HTML.
 */
export async function openSim(
  testId: string,
  options?: OpenSimOptions
): Promise<OpenSim> {
  ensureNodeLocalStoragePolyfill();
  const mode = resolveSimMode(options);
  if (mode !== 'fast') {
    process.env['SIM_MODE'] = mode;
  }
  const reporting = simReportEnabled();
  const callSite = reporting ? testCallSite(new Error().stack) : null;
  const s = await product.run({
    seed: 1,
    runtime: resolveHostName(options),
    ...(reporting
      ? {
          report: {
            store: getReportStore(),
            runId: SIM_REPORT_RUN_ID,
            testId,
            now: () => wallClock.now(),
            ...(callSite ?? {}),
          },
        }
      : {}),
  });
  const surface = await pinSim(s);
  const snapshot =
    options?.snapshot !== undefined
      ? readSimSystemSnapshot(options.snapshot)
      : undefined;
  if (snapshot !== undefined) {
    await restoreSnapshot(surface.sim, snapshot);
  }
  const extra = productExtra(surface);
  let httpListener: SimHttpListener | null = null;
  if (extra.http.kind === 'localhost') {
    httpListener = await listenSimHttpServer(surface.sim);
  }
  // Replace create()-default runtime with report / snapshot / HTTP extras.
  wireProductRuntime(surface, {
    ...(snapshot !== undefined ? { snapshot } : {}),
    recorder: reporting ? { record: (meta, fn) => s.record(meta, fn) } : null,
    onDispose: async () => {
      if (httpListener !== null) {
        await httpListener.stop();
      }
      clearNodeLocalStoragePolyfill();
      await new Promise<void>((resolve) => {
        simNodeTimers.setTimeout(resolve, 50);
      });
    },
  });
  // create() already registered disposeResources on session.onDispose; the
  // replacement runtime is what runs on dispose.
  return s;
}

export type { OpenSimOptions, ProductExtra, SimMode };
