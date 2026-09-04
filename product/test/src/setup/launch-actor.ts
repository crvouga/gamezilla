/**
 * Per-actor UI launch / teardown for product {@link openSim}.
 */

import type { Timers } from '@pkgs/clock';
import { wallClock } from '@pkgs/clock';
import { writeUtf8 } from '@pkgs/object-store/helpers';
import type { ObjectStore } from '@pkgs/object-store/interface';
import { createNodeFsObjectStore } from '@pkgs/object-store-node-fs/impl-node-fs';
import { wallNodeFs } from '@pkgs/object-store-node-fs/wall-node-fs';
import { resolveSimConsoleReportsDir, wallPathExists } from '@pkgs/sim-console';
import type { SimSystemSnapshot } from '@pkgs/sim-console/shared/sim-system-snapshot';
import type { Driver } from '@pkgs/ui-testing';
import { BunWebviewDriver } from '@pkgs/ui-testing-bun-webview';
import type { MultiAppRntlSession } from '@pkgs/ui-testing-rntl';
import { RntlDriver } from '@pkgs/ui-testing-rntl';
import { SNAPSHOT_SHELL_CSS } from '@pkgs/ui-testing-rntl/serialize-host-tree-html';
import type { ProductUi, Sim, SimActor } from '@product/sim';
import { simClientNamespace } from '@product/sim';

import { injectWebViewSnapshotAuth } from './inject-webview-snapshot-auth';
import { simNodeTimers } from './sim-actor-overrides';
import { createSimWaitPump } from './sim-wait-pump';

const reportFs = wallNodeFs();
const reportDataDir = resolveSimConsoleReportsDir(
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

function createRntlClientDriver(args: {
  readonly sim: Sim;
  readonly id: string;
  readonly rntl: MultiAppRntlSession;
  readonly runFor: (durationMs: number) => Promise<void>;
}): Driver {
  const { createElement } = require('react') as typeof import('react');
  const live = args.sim.spawnClient(args.id);
  const pump = createSimWaitPump({
    scheduler: args.sim.scheduler,
    runFor: args.runFor,
  });
  const timers: Timers = simNodeTimers;
  return new RntlDriver({
    now: wallClock.now,
    timers,
    pump,
    harness: {
      mount: async () => {
        const app = args.rntl.mountActor(
          args.id,
          createElement(live.App, { embedded: true })
        );
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
  let closeResources: () => Promise<void> = async () => undefined;
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
    closeResources = async () => {
      view.close();
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
    const rntl = args.ui.rntl;
    if (rntl === undefined) {
      throw new Error(
        'launchActor: react-tree host requires an RNTL session (in-process tests)'
      );
    }
    raw = createRntlClientDriver({
      sim: args.sim,
      id: args.id,
      rntl,
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
