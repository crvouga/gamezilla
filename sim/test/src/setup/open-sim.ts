/**
 * Open a product UI simulation: `start(product)` on {@link simHost} / {@link maxHost}.
 */

import type { Host, Ports, Run, Session } from '@pkgs/dst';
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
import { productExtra } from '../scenario/surface';
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
  readonly surface: ProductSurface;
  readonly testId: string;
  readonly snapshot?: SimSystemSnapshot;
}): Promise<void> {
  const { surface } = args;
  const extra = productExtra(surface);
  if (args.snapshot !== undefined) {
    await restoreSnapshot(surface.sim, args.snapshot);
  }
  if (simReportEnabled()) {
    await reportFs.mkdir(reportDataDir, { recursive: true });
  }
  const rntl = rntlOf(extra.ui);
  const reporter = createSimReporter({
    testId: args.testId,
    sim: surface.sim,
    driverKind: extra.ui.kind === 'playwright' ? 'playwright' : 'rntl',
    rntl,
  });
  const wired: WiredRuntime = {
    entries: new Map(),
    reporter,
    httpListener: null,
  };
  if (extra.http.kind === 'loopback') {
    wired.httpListener = await listenSimHttpServer(surface.sim);
  }
  surface.runtime = makeRuntime({
    surface,
    extra,
    reporter,
    snapshot: args.snapshot,
    wired,
  });
}

/**
 * Pin the surface for setup wiring only. `Run` is the sole public handle —
 * scenarios never see this, and nothing outside this module may call it.
 */
async function pinSurface(run: Run<ProductSurface>): Promise<ProductSurface> {
  let pinned: ProductSurface | null = null;
  const capture = product.defineAction({
    name: 'openSim.pinSurface',
    generate() {
      return (s: ProductSurface) => {
        pinned = s;
      };
    },
  });
  await run.apply(capture);
  if (pinned === null) {
    throw new Error('openSim: surface pin did not run');
  }
  return pinned;
}

/**
 * Product resources are torn down when the run disposes its session; the hook
 * is installed before `start` and filled in once the runtime is wired.
 */
function hostWithProductDispose(
  host: Host<Ports & ProductExtra>,
  disposeRef: { current: (() => Promise<void>) | null }
): Host<Ports & ProductExtra> {
  return host.with(async (session: Session<Ports & ProductExtra>) => {
    const disposeSession = session.dispose.bind(session);
    (session as { dispose: () => Promise<void> }).dispose = async () => {
      try {
        await disposeRef.current?.();
      } finally {
        await disposeSession();
      }
    };
    return {};
  });
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
): Promise<OpenSimHandle> {
  const { ctx, options } = resolveArgs(ctxOrOptions, maybeOptions);
  ensureNodeLocalStoragePolyfill();
  const disposeRef: { current: (() => Promise<void>) | null } = {
    current: null,
  };
  const host = hostWithProductDispose(resolveHost(ctx, options), disposeRef);
  const run = await start(product, {
    host: host as Host<Ports>,
    seed: 1,
    properties: PRODUCT_PROPERTIES,
  });
  const surface = await pinSurface(run);
  const snapshot =
    options?.snapshot !== undefined
      ? readSimSystemSnapshot(options.snapshot)
      : undefined;
  await wireSurface({
    surface,
    testId,
    ...(snapshot !== undefined ? { snapshot } : {}),
  });
  disposeRef.current = () => surface.runtime.disposeResources();
  return run;
}

export type { OpenSimFidelity, OpenSimOptions };
