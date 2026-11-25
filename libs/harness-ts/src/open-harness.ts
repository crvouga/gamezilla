/**
 * Open a product UI simulation: `system.run` on a registered host
 * (`in-process` / `bun-webview`) of a {@link defineProductSystem} system.
 */

import type { Client } from '@libs/app-root-client-ts/create-client';
import type { HarnessSystemSnapshot } from '@pkgs/harness-console-shared-ts/system-snapshot';
import { defineAction } from '@pkgs/harness-root-shared-ts/define-action';
import type { Run } from '@pkgs/harness-root-shared-ts/run-types';
import { harnessNodeTimers } from './actor-overrides';
import type { Harness } from './create-harness';
import type { ProductSystem } from './define-product-system';
import type { ProductHarness } from './harness';
import { productExtra } from './harness';
import type { HarnessHttpListener } from './localhost-http';
import { listenHarnessHttpServer } from './localhost-http';
import type { OpenHarnessOptions } from './mode';
import { isLiveBrowserMode, resolveHarnessMode } from './mode';
import {
  clearNodeLocalStoragePolyfill,
  ensureNodeLocalStoragePolyfill,
} from './node-local-storage-polyfill';
import type { ProductHostName } from './ports';
import { readHarnessSystemSnapshot } from './snapshot-fixture';
import type { HarnessSql } from './sql-types';
import { stackRunSeed } from './stack-manifest';
import type { SystemSnapshotCtx } from './system-snapshot';
import { restoreSystemSnapshot } from './system-snapshot';
import { wireProductRuntime } from './wire-product-runtime';
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

/** Open a product harness on the host its mode selects. */
export async function openHarness(
  system: ProductSystem,
  options?: OpenHarnessOptions
): Promise<OpenHarness> {
  ensureNodeLocalStoragePolyfill();
  const mode = resolveHarnessMode(options);
  if (mode !== 'fast') {
    process.env['HARNESS_MODE'] = mode;
  }
  const s = await system.run({
    seed: options?.seed ?? (mode === 'stack' ? stackRunSeed() : 1),
    runtime: resolveHostName(options),
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
  // Replace create()-default runtime with snapshot / HTTP extras.
  wireProductRuntime(surface, {
    ...(snapshot !== undefined ? { snapshot } : {}),
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
