/**
 * Open a product UI simulation: `product.run` on the `rntl` / `playwright`
 * runtime registered by the product system.
 */

import { wallClock } from '@pkgs/clock';
import type { Run } from '@pkgs/sim';
import { defineAction } from '@pkgs/sim';
import type { SimSystemSnapshot } from '@pkgs/sim-console/shared/sim-system-snapshot';
import type { UiTestCtx } from '@pkgs/ui-testing';
import type { Sim } from '@product/console/sim/create-sim';
import type { SimSql } from '@product/console/sim/sim-sql';
import {
  restoreSystemSnapshot,
  type SystemSnapshotCtx,
} from '@product/console/sim/system-snapshot';

import '@apps/client/i18n/i18n';

import type { ProductExtra, ProductUi } from '../runtime/ports';
import type { ProductRuntime, ProductSim, SimActor } from '../sim';
import { product, productExtra } from '../sim';
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
import { listenSimHttpServer, type SimHttpListener } from './sim-http-listener';
import { readSimSystemSnapshot } from './sim-snapshot-fixture';

export type { SimActor };
export type OpenSim = Run<ProductSim>;

function isUiTestCtx(value: unknown): value is UiTestCtx {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record['fidelity'] === 'string' &&
    typeof record['driverKind'] === 'string' &&
    typeof record['test'] === 'function'
  );
}

/** Registered host name — driver kind is the host identity. */
function resolveHostName(
  ctx: UiTestCtx | undefined,
  options: OpenSimOptions | undefined
): 'rntl' | 'playwright' {
  // UiTestCtx exposes fidelity ('sim'|'max'); OpenSimOptions uses mode.
  const mode =
    ctx?.fidelity === 'max'
      ? 'real'
      : ctx?.fidelity === 'sim'
        ? 'fast'
        : resolveSimMode(options);
  const driverKind =
    ctx?.driverKind ?? (mode === 'real' ? 'playwright' : 'rntl');
  return driverKind === 'playwright' ? 'playwright' : 'rntl';
}

type WiredRuntime = {
  readonly entries: Map<string, ActorEntry>;
  httpListener: SimHttpListener | null;
};

function rntlOf(ui: ProductUi) {
  return ui.kind === 'rntl' ? ui.rntl : null;
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
  rntlOf(extra.ui)?.dispose();
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
  if (extra.http.kind === 'loopback') {
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
  let pinned: ProductSim | null = null;
  const capture = defineAction({
    name: 'openSim.pinSim',
    act: (s: ProductSim) => {
      pinned = s;
    },
  });
  await s.apply(capture);
  if (pinned === null) {
    throw new Error('openSim: surface pin did not run');
  }
  return pinned;
}

function resolveArgs(
  ctxOrOptions?: UiTestCtx | OpenSimOptions,
  maybeOptions?: OpenSimOptions
): {
  readonly ctx: UiTestCtx | undefined;
  readonly options: OpenSimOptions | undefined;
} {
  const ctx =
    ctxOrOptions !== undefined && isUiTestCtx(ctxOrOptions)
      ? ctxOrOptions
      : undefined;
  const options =
    ctx !== undefined
      ? maybeOptions
      : (ctxOrOptions as OpenSimOptions | undefined);
  return { ctx, options };
}

export async function openSim(
  testId: string,
  ctxOrOptions?: UiTestCtx | OpenSimOptions,
  maybeOptions?: OpenSimOptions
): Promise<OpenSim> {
  const { ctx, options } = resolveArgs(ctxOrOptions, maybeOptions);
  ensureNodeLocalStoragePolyfill();
  if (simReportEnabled()) {
    await prepareReportStore();
  }
  const s = await product.run({
    seed: 1,
    runtime: resolveHostName(ctx, options),
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
  // Product resources tear down with the session the run owns.
  surface.session.onDispose(() => surface.runtime.disposeResources());
  return s;
}

export type { OpenSimOptions, SimMode };
