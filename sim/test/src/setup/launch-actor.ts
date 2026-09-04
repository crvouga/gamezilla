/**
 * Per-actor UI launch / teardown for product {@link openSim}.
 */

import type { Timers } from '@pkgs/clock';
import { wallClock } from '@pkgs/clock';
import { writeUtf8 } from '@pkgs/object-store/helpers';
import { createNodeFsObjectStore } from '@pkgs/object-store/impl-node-fs';
import { wallNodeFs } from '@pkgs/object-store/wall-node-fs';
import {
  createReportingDriver,
  projectReportTopology,
  resolveSimConsoleReportsDir,
  SimulationReporter,
  wallPathExists,
} from '@pkgs/sim-console';
import type { SimSystemSnapshot } from '@pkgs/sim-console/shared/sim-system-snapshot';
import type { Driver, UiTestCtx } from '@pkgs/ui-testing';
import { createDriver, getUiTestBrowser } from '@pkgs/ui-testing';
import type { Page } from '@playwright/test';
import { type Sim, simClientNamespace } from '@sim/console/sim/create-sim';

import type { ProductUi } from '../runtime/ports';
import type { SimActor } from '../sim/sim';
import { injectPlaywrightSnapshotAuth } from './playwright-snapshot-auth';
import { simNodeTimers } from './sim-actor-overrides';
import { simReportTopology } from './sim-report-topology';
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

const STATIC_REPORT_RUN_ID = 'latest_run';
const FRAME_STYLESHEET_HREF = '../../snapshot-shell.css';

export function simReportEnabled(): boolean {
  return process.env['SIM_REPORT'] !== '0';
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

type MultiAppRntlSession = Extract<ProductUi, { kind: 'rntl' }>['rntl'];

export function createSimReporter(args: {
  readonly testId: string;
  readonly sim: Sim;
  readonly driverKind: UiTestCtx['driverKind'];
  readonly rntl: MultiAppRntlSession | null;
}): SimulationReporter | null {
  if (!simReportEnabled()) return null;
  return new SimulationReporter({
    seed: '1',
    store: reportStore,
    runId: STATIC_REPORT_RUN_ID,
    testId: args.testId,
    now: () => wallClock.now(),
    maxFramesPerStep: 1,
    frameIntervalMs: 250,
    publishThrottleMs: Number.POSITIVE_INFINITY,
    ui: args.driverKind,
    snapshotTopology: () =>
      projectReportTopology(simReportTopology(args.sim), '1'),
    snapshotViews: async () => {
      if (args.rntl === null) return [];
      const snapshots = await args.rntl.snapshotAllActors({
        stylesheetHref: FRAME_STYLESHEET_HREF,
      });
      return [...snapshots.entries()].map(([nodeId, html]) => ({
        nodeId,
        html,
      }));
    },
  });
}

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
  return createDriver({
    kind: 'rntl',
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

async function createPlaywrightClientDriver(args: {
  readonly id: string;
  readonly snapshot?: SimSystemSnapshot;
}): Promise<{
  readonly driver: Driver;
  readonly page: Page;
  close: () => Promise<void>;
}> {
  const browser = getUiTestBrowser() as
    | import('@playwright/test').Browser
    | undefined;
  if (browser === undefined) {
    throw new Error(
      'openSim max: Playwright browser unavailable — run scenarios via test:max'
    );
  }
  const baseUrl = process.env['PLAYWRIGHT_BASE_URL'] ?? 'http://127.0.0.1:5173';
  const context = await browser.newContext();
  const page = await context.newPage();
  if (args.snapshot !== undefined) {
    await injectPlaywrightSnapshotAuth({
      page,
      actorId: args.id,
      snapshot: args.snapshot,
      namespace: simClientNamespace(args.id),
    });
  }
  return {
    driver: createDriver({ kind: 'playwright', page, baseUrl }),
    page,
    close: async () => {
      await context.close();
    },
  };
}

export async function launchActor(args: {
  readonly ui: ProductUi;
  readonly sim: Sim;
  readonly id: string;
  readonly reporter: SimulationReporter | null;
  readonly snapshot?: SimSystemSnapshot;
}): Promise<ActorEntry> {
  let raw: Driver;
  let closeResources: () => Promise<void> = async () => undefined;
  if (args.ui.kind === 'playwright') {
    const pw = await createPlaywrightClientDriver({
      id: args.id,
      ...(args.snapshot !== undefined ? { snapshot: args.snapshot } : {}),
    });
    raw = pw.driver;
    closeResources = pw.close;
  } else {
    raw = createRntlClientDriver({
      sim: args.sim,
      id: args.id,
      rntl: args.ui.rntl,
      runFor: args.ui.runFor,
    });
  }
  const ui =
    args.reporter === null
      ? raw
      : createReportingDriver(raw, {
          actorId: args.id,
          reporter: args.reporter,
        });
  await ui.launch();
  return {
    handle: { id: args.id, ui },
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
