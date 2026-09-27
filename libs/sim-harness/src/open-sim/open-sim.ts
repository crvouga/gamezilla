/**
 * Open a product UI simulation: `system.run` on a registered host
 * (`in-process` / `bun-webview`) of a {@link defineProductSystem} system.
 */

import type { Client } from '@libs/client-app/shell/create-client';
import { wallClock } from '@pkgs/clock';
import type { Run } from '@pkgs/sim';
import { defineAction } from '@pkgs/sim';
import type { SimSystemSnapshot } from '@pkgs/sim-console/shared/sim-system-snapshot';
import type {
  ProductExtra,
  ProductHostName,
  ProductSim,
  Sim,
  SimActor,
  SimHttpListener,
  SimSql,
} from '..';
import {
  listenSimHttpServer,
  type ProductSystem,
  productExtra,
  restoreSystemSnapshot,
  type SystemSnapshotCtx,
} from '..';

import { wireProductRuntime } from '../setup/wire-product-runtime';
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
  simFramesEnabled,
  type TestCallSite,
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
  const liveClients = new Map<string, Client>();
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
 * The report key for a test: its spec file's name, then the id the test
 * chose. Parallel workers share one bucket, so two specs that happen to pick
 * the same id must not overwrite each other's report.
 */
function reportTestId(testId: string, callSite: TestCallSite | null): string {
  if (callSite === null) return testId;
  const file = callSite.sourceFile.split('/').pop() ?? '';
  const stem = file.replace(/\.test\.[cm]?[jt]sx?$/, '');
  return stem.length > 0 ? `${stem}.${testId}` : testId;
}

/**
 * Open a reported product sim. Every run writes its report into the
 * package's `.cache/sim-report` (frames only with `SIM_FRAMES=1`);
 * `bun run test:report` folds every package's bucket into one HTML report.
 */
export async function openSim(
  system: ProductSystem,
  testId: string,
  options?: OpenSimOptions
): Promise<OpenSim> {
  ensureNodeLocalStoragePolyfill();
  const mode = resolveSimMode(options);
  if (mode !== 'fast') {
    process.env['SIM_MODE'] = mode;
  }
  const named = options?.report;
  const callSite: TestCallSite | null =
    named !== undefined
      ? {
          sourceFile: named.sourceFile,
          sourceLine: named.sourceLine ?? 1,
        }
      : testCallSite(new Error().stack);
  const s = await system.run({
    seed: options?.seed ?? 1,
    runtime: resolveHostName(options),
    report: {
      store: getReportStore(),
      runId: SIM_REPORT_RUN_ID,
      testId: named !== undefined ? testId : reportTestId(testId, callSite),
      frames: simFramesEnabled(),
      now: () => wallClock.now(),
      ...(named !== undefined ? { title: named.title } : {}),
      ...(callSite ?? {}),
    },
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
    recorder: { record: (meta, fn) => s.record(meta, fn) },
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
