/**
 * Open a product UI simulation: `start(product)` on {@link simHost} / {@link maxHost}.
 */

import type { Host, Ports, Run } from '@pkgs/dst';
import { start } from '@pkgs/dst';
import type { SimulationReporter } from '@pkgs/sim-console';
import type { SimSystemSnapshot } from '@pkgs/sim-console/shared/sim-system-snapshot';
import type { UiTestCtx } from '@pkgs/ui-testing';
import type { Sim } from '@sim/console/sim/create-sim';
import type { SimSqlHandle } from '@sim/console/sim/sim-sql';
import {
  restoreSystemSnapshot,
  type SystemSnapshotCtx,
} from '@sim/console/sim/system-snapshot';

import '@apps/client/i18n/i18n';

import { maxHost, simHost } from '../host';
import type { ProductExtra, ProductUi } from '../host/ports';
import { PRODUCT_PROPERTIES } from '../scenario/observations';
import type { ProductRuntime, SimActorHandle } from '../scenario/surface';
import { type ProductSurface, product } from '../scenario/system';
import {
  type OpenSimFidelity,
  type OpenSimOptions,
  resolveOpenSimFidelity,
} from './fidelity';
import {
  type ActorEntry,
  closeActorEntry,
  createSimReporter,
  launchActor as launchActorEntry,
  reportDataDir,
  reportFs,
  simReportEnabled,
  writeKeysIndex,
} from './launch-actor';
import { ensureNodeLocalStoragePolyfill } from './node-local-storage-polyfill';
import { simNodeTimers } from './sim-actor-overrides';
import { listenSimHttpServer, type SimHttpListener } from './sim-http-listener';
import { readSimSystemSnapshot } from './sim-snapshot-fixture';

export type { SimActorHandle };
export type OpenSimHandle = Run<ProductSurface>;

export function productOf(run: Run<ProductSurface>): ProductSurface {
  return run._internal.surface;
}

function isUiTestCtx(value: unknown): value is UiTestCtx {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record['fidelity'] === 'string' &&
    typeof record['driverKind'] === 'string' &&
    typeof record['test'] === 'function'
  );
}

function resolveHost(
  ctx: UiTestCtx | undefined,
  options: OpenSimOptions | undefined
): Host<Ports & ProductExtra> {
  const fidelity = ctx?.fidelity ?? resolveOpenSimFidelity(options);
  const driverKind =
    ctx?.driverKind ?? (fidelity === 'max' ? 'playwright' : 'rntl');
  return driverKind === 'playwright' ? maxHost() : simHost();
}

function extraOf(session: { readonly ports: object }): ProductExtra {
  return session.ports as ProductExtra;
}

type WiredRuntime = {
  readonly entries: Map<string, ActorEntry>;
  readonly reporter: SimulationReporter | null;
  httpListener: SimHttpListener | null;
};

function rntlOf(ui: ProductUi) {
  return ui.kind === 'rntl' ? ui.rntl : null;
}

function makeRuntime(args: {
  readonly surface: ProductSurface;
  readonly extra: ProductExtra;
  readonly reporter: SimulationReporter | null;
  readonly snapshot: SimSystemSnapshot | undefined;
  readonly wired: WiredRuntime;
}): ProductRuntime {
  const { surface, extra, reporter, snapshot, wired } = args;
  return {
    async launchActor(id) {
      const entry = await launchActorEntry({
        ui: extra.ui,
        sim: surface.sim,
        id,
        reporter,
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
    clearUiFocus() {
      rntlOf(extra.ui)?.clearFocus();
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
  if (wired.reporter !== null) {
    try {
      await wired.reporter.flush();
      await writeKeysIndex();
    } catch (err) {
      console.error(
        '[openSim] report flush failed:',
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
  const clientSqlByAddress = new Map<string, SimSqlHandle>();
  const liveClients = new Map<string, ReturnType<Sim['spawnClient']>>();
  const snapshotCtx: SystemSnapshotCtx = {
    sim,
    clientIds: snapshot.clientIds,
    liveClients,
    clientSqlByAddress,
  };
  await restoreSystemSnapshot(snapshotCtx, snapshot);
}

async function wireSurface(args: {
  readonly run: Run<ProductSurface>;
  readonly extra: ProductExtra;
  readonly testId: string;
  readonly snapshot?: SimSystemSnapshot;
}): Promise<void> {
  const surface = productOf(args.run);
  if (args.snapshot !== undefined) {
    await restoreSnapshot(surface.sim, args.snapshot);
  }
  if (simReportEnabled()) {
    await reportFs.mkdir(reportDataDir, { recursive: true });
  }
  const rntl = rntlOf(args.extra.ui);
  const reporter = createSimReporter({
    testId: args.testId,
    sim: surface.sim,
    driverKind: args.extra.ui.kind === 'playwright' ? 'playwright' : 'rntl',
    rntl,
  });
  const wired: WiredRuntime = {
    entries: new Map(),
    reporter,
    httpListener: null,
  };
  if (args.extra.http.kind === 'loopback') {
    wired.httpListener = await listenSimHttpServer(surface.sim);
  }
  surface.runtime = makeRuntime({
    surface,
    extra: args.extra,
    reporter,
    snapshot: args.snapshot,
    wired,
  });
}

function wrapRun(run: Run<ProductSurface>): OpenSimHandle {
  return {
    apply: run.apply.bind(run),
    observe: run.observe.bind(run),
    assert: run.assert.bind(run),
    async [Symbol.asyncDispose]() {
      await productOf(run).runtime.disposeResources();
      await run[Symbol.asyncDispose]();
    },
    _internal: run._internal,
  };
}

export async function openSim(
  testId: string,
  ctxOrOptions?: UiTestCtx | OpenSimOptions,
  maybeOptions?: OpenSimOptions
): Promise<OpenSimHandle> {
  const ctx =
    ctxOrOptions !== undefined && isUiTestCtx(ctxOrOptions)
      ? ctxOrOptions
      : undefined;
  const options =
    ctx !== undefined
      ? maybeOptions
      : (ctxOrOptions as OpenSimOptions | undefined);
  ensureNodeLocalStoragePolyfill();
  const host = resolveHost(ctx, options);
  const run = await start(product, {
    host: host as Host<Ports>,
    seed: 1,
    properties: PRODUCT_PROPERTIES,
  });
  const extra = extraOf(productOf(run).session);
  const snapshot =
    options?.snapshot !== undefined
      ? readSimSystemSnapshot(options.snapshot)
      : undefined;
  await wireSurface({
    run,
    extra,
    testId,
    ...(snapshot !== undefined ? { snapshot } : {}),
  });
  return wrapRun(run);
}

export type { OpenSimFidelity, OpenSimOptions };
