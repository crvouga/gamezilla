/**
 * Per-actor UI launch / teardown for product {@link openSim}.
 */

import type { ProductUi, Sim, SimActor } from '@apps/product/sim';
import { simClientNamespace } from '@apps/product/sim';
import { wallClock } from '@pkgs/clock';
import { writeUtf8 } from '@pkgs/object-store/helpers';
import type { ObjectStore } from '@pkgs/object-store/interface';
import { createNodeFsObjectStore } from '@pkgs/object-store-node-fs/impl-node-fs';
import { wallNodeFs } from '@pkgs/object-store-node-fs/wall-node-fs';
import { resolveSimConsoleProductTestsDir } from '@pkgs/sim-console/local-data-dir';
import type { SimSystemSnapshot } from '@pkgs/sim-console/shared/sim-system-snapshot';
import { wallPathExists } from '@pkgs/sim-console/wall-path-exists';
import type { Driver } from '@pkgs/ui-testing';
import { BunWebviewDriver } from '@pkgs/ui-testing-bun-webview';
import {
  createSolidDomDriver,
  type MultiAppSolidDomSession,
  SNAPSHOT_SHELL_CSS,
} from '@pkgs/ui-testing-solid-dom';
import { createSimWaitPump } from '../../sim/setup/sim-wait-pump';
import { injectWebViewSnapshotAuth } from './inject-webview-snapshot-auth';
import { solidActorRoot } from './solid-actor-root';

const reportFs = wallNodeFs();
const reportDataDir = resolveSimConsoleProductTestsDir(
  process.cwd(),
  wallPathExists
);
const reportStore = createNodeFsObjectStore({
  rootDir: reportDataDir,
  fs: reportFs,
  layout: 'tree',
});

export const STATIC_REPORT_RUN_ID = 'latest_run';

export function simReportEnabled(): boolean {
  return process.env['SIM_REPORT'] !== '0';
}

export function getReportStore(): ObjectStore {
  return reportStore;
}

export async function prepareReportStore(): Promise<void> {
  await reportFs.mkdir(reportDataDir, { recursive: true });
  await writeUtf8(
    reportStore,
    `runs/${STATIC_REPORT_RUN_ID}/snapshot-shell.css`,
    SNAPSHOT_SHELL_CSS,
    'text/css; charset=utf-8'
  );
}

export async function writeKeysIndex(): Promise<void> {
  const keys = await reportStore.listKeys();
  await writeUtf8(
    reportStore,
    'keys.json',
    JSON.stringify(keys),
    'application/json'
  );
}

export type ActorEntry = {
  readonly handle: SimActor;
  readonly raw: Driver;
  readonly closeResources: () => Promise<void>;
};

/**
 * Solid DOM driver for one in-process actor. Waits are pump-driven (the sim's
 * virtual `runFor`), deadlines run on the wall clock so virtual-time stepping
 * never eats the wait budget.
 */
function createSolidDomClientDriver(args: {
  readonly sim: Sim;
  readonly id: string;
  readonly session: MultiAppSolidDomSession;
  readonly runFor: (durationMs: number) => Promise<void>;
}): Driver {
  const live = args.sim.spawnClient(args.id);
  const pump = createSimWaitPump({
    scheduler: args.sim.scheduler,
    runFor: args.runFor,
  });
  return createSolidDomDriver({
    clock: wallClock,
    pump,
    harness: {
      mount: async () => {
        const app = args.session.mountActor(args.id, solidActorRoot(live));
        await args.runFor(0);
        return app;
      },
    },
  });
}

export async function launchActor(args: {
  readonly ui: ProductUi;
  readonly sim: Sim;
  readonly id: string;
  readonly snapshot?: SimSystemSnapshot;
}): Promise<ActorEntry> {
  let raw: Driver;
  let closeResources: () => Promise<void> = () => Promise.resolve();
  if (args.ui.kind === 'bun-webview') {
    const webOrigin = args.ui.webOrigin;
    const view = new Bun.WebView({
      url: webOrigin,
      width: 390,
      height: 844,
    });
    raw = new BunWebviewDriver({
      view,
      baseUrl: webOrigin,
      actorId: args.id,
    });
    closeResources = () => {
      view.close();
      return Promise.resolve();
    };
    await raw.launch();
    if (args.snapshot !== undefined) {
      await injectWebViewSnapshotAuth({
        view,
        actorId: args.id,
        snapshot: args.snapshot,
        namespace: simClientNamespace(args.id),
        origin: webOrigin,
      });
    }
  } else {
    const session = args.ui.session;
    if (session === undefined) {
      throw new Error(
        'launchActor: solid-dom host requires a MultiAppSolidDomSession (in-process tests)'
      );
    }
    raw = createSolidDomClientDriver({
      sim: args.sim,
      id: args.id,
      session,
      runFor: args.ui.runFor,
    });
    await raw.launch();
  }
  return {
    handle: { id: args.id, ui: raw },
    raw,
    closeResources,
  };
}

export async function closeActorEntry(entry: ActorEntry): Promise<void> {
  try {
    await entry.raw.close();
  } catch {
    // ignore teardown races
  }
  try {
    await entry.closeResources();
  } catch {
    // ignore teardown races
  }
}

export { reportDataDir, reportFs };
