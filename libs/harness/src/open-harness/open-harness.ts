/**
 * Open a product UI simulation: `system.run` on a registered host
 * (`in-process` / `bun-webview`) of a {@link defineProductSystem} system.
 */

import type { Client } from '@libs/client-app/shell/create-client';
import { wallClock } from '@pkgs/clock';
import type { Run } from '@pkgs/harness';
import { defineAction } from '@pkgs/harness';
import type { HarnessSystemSnapshot } from '@pkgs/harness-console/shared/system-snapshot';
import type {
  Harness,
  HarnessActor,
  HarnessHttpListener,
  HarnessSql,
  ProductExtra,
  ProductHarness,
  ProductHostName,
} from '..';
import {
  listenHarnessHttpServer,
  type ProductSystem,
  productExtra,
  restoreSystemSnapshot,
  type SystemSnapshotCtx,
} from '..';

import { wireProductRuntime } from '../setup/wire-product-runtime';
import { harnessNodeTimers } from './actor-overrides';
import {
  type HarnessMode,
  isLiveBrowserMode,
  type OpenHarnessOptions,
  resolveHarnessMode,
} from './mode';
import {
  clearNodeLocalStoragePolyfill,
  ensureNodeLocalStoragePolyfill,
} from './node-local-storage-polyfill';
import {
  getReportStore,
  HARNESS_REPORT_RUN_ID,
  harnessFramesEnabled,
  type TestCallSite,
  testCallSite,
} from './report';
import { readHarnessSystemSnapshot } from './snapshot-fixture';

export type { HarnessActor };
export type OpenHarness = Run<ProductHarness>;

function resolveHostName(
  options: OpenHarnessOptions | undefined
): ProductHostName {
  return isLiveBrowserMode(resolveHarnessMode(options))
    ? 'bun-webview'
    : 'in-process';
}

async function restoreSnapshot(
  harness: Harness,
  snapshot: HarnessSystemSnapshot
): Promise<void> {
  const clientSqlByAddress = new Map<string, HarnessSql>();
  const liveClients = new Map<string, Client>();
  const snapshotCtx: SystemSnapshotCtx = {
    harness,
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
async function pinHarness(s: Run<ProductHarness>): Promise<ProductHarness> {
  const pin: { current: ProductHarness | null } = { current: null };
  const capture = defineAction({
    name: 'openHarness.pinHarness',
    report: false,
    act: (surf: ProductHarness) => {
      pin.current = surf;
    },
  });
  await s.apply(capture);
  if (pin.current === null) {
    throw new Error('openHarness: surface pin did not run');
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
 * Open a reported product harness. Every run writes its report into the
 * package's `.cache/harness-report` (frames only with `HARNESS_FRAMES=1`);
 * `bun run check:report` folds every package's bucket into one HTML report.
 */
export async function openHarness(
  system: ProductSystem,
  testId: string,
  options?: OpenHarnessOptions
): Promise<OpenHarness> {
  ensureNodeLocalStoragePolyfill();
  const mode = resolveHarnessMode(options);
  if (mode !== 'fast') {
    process.env['HARNESS_MODE'] = mode;
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
      runId: HARNESS_REPORT_RUN_ID,
      testId: named !== undefined ? testId : reportTestId(testId, callSite),
      frames: harnessFramesEnabled(),
      now: () => wallClock.now(),
      ...(named !== undefined ? { title: named.title } : {}),
      ...(callSite ?? {}),
    },
  });
  const surface = await pinHarness(s);
  const snapshot =
    options?.snapshot !== undefined
      ? readHarnessSystemSnapshot(options.snapshot)
      : undefined;
  if (snapshot !== undefined) {
    await restoreSnapshot(surface.harness, snapshot);
  }
  const extra = productExtra(surface);
  let httpListener: HarnessHttpListener | null = null;
  if (extra.http.kind === 'localhost') {
    httpListener = await listenHarnessHttpServer(surface.harness);
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
        harnessNodeTimers.setTimeout(resolve, 50);
      });
    },
  });
  // create() already registered disposeResources on session.onDispose; the
  // replacement runtime is what runs on dispose.
  return s;
}

export type { HarnessMode, OpenHarnessOptions, ProductExtra };
