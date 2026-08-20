/**
 * Open a client UI simulation on createSim.
 */

import { createSim, type Sim } from '@apps/client/sim/create-sim';
import { type SimSqlHandle, sharedSqlClient } from '@apps/client/sim/sim-sql';
import { type Timers, wallClock } from '@pkgs/clock';
import { readUtf8, writeUtf8 } from '@pkgs/object-store/helpers';
import { createNodeFsObjectStore } from '@pkgs/object-store/impl-node-fs';
import { wallNodeFs } from '@pkgs/object-store/wall-node-fs';
import {
  createReportingDriver,
  mintRunId,
  projectReportTopology,
  resolveLocalReportDataDir,
  SimulationReporter,
  wallPathExists,
} from '@pkgs/system-console';
import type { Driver } from '@pkgs/ui-testing';
import { createDriver, createRenderedAppFromRntl } from '@pkgs/ui-testing';
import type { Page } from '@playwright/test';
import { render } from '@testing-library/react-native';
import { createElement } from 'react';

import '@apps/client/i18n/i18n';

import {
  type OpenSimFidelity,
  type OpenSimOptions,
  resolveOpenSimFidelity,
} from './fidelity';
import { simNodeTimers } from './sim-actor-overrides';
import {
  simReportTopology,
  snapshotSimCheckpoint,
  snapshotSimDatabases,
} from './sim-world-snapshot';

const reportDataDir = resolveLocalReportDataDir(process.cwd(), wallPathExists);

const reportStore = createNodeFsObjectStore({
  rootDir: reportDataDir,
  fs: wallNodeFs(),
  layout: 'sidecar',
});

const RUN_MARKER_KEY = '.jest-open-sim-run.json';

type RunMarker = {
  readonly pid: number;
  readonly runId: string;
};

async function resolveProcessRunId(): Promise<string> {
  const fromEnv = process.env['SIM_REPORT_RUN_ID'];
  if (fromEnv !== undefined && fromEnv.length > 0) return fromEnv;

  try {
    const text = await readUtf8(reportStore, RUN_MARKER_KEY);
    if (text !== null) {
      const marker = JSON.parse(text) as RunMarker;
      if (marker.pid === process.pid && marker.runId.length > 0) {
        return marker.runId;
      }
    }
  } catch {
    // Missing or corrupt — mint below.
  }

  const runId = mintRunId(wallClock.now());
  await writeUtf8(
    reportStore,
    RUN_MARKER_KEY,
    `${JSON.stringify({ pid: process.pid, runId } satisfies RunMarker)}\n`,
    'application/json'
  );
  return runId;
}

export type SimActorHandle = {
  readonly id: string;
  readonly ui: Driver;
};

export type OpenSimHandle = {
  readonly sim: Sim;
  readonly fidelity: OpenSimFidelity;
  actor(id: string): Promise<SimActorHandle>;
  dispose(): Promise<void>;
  [Symbol.asyncDispose](): Promise<void>;
};

function injectedPlaywrightPage(): Page | undefined {
  const holder = globalThis as { readonly __PLAYWRIGHT_PAGE__?: Page };
  return holder.__PLAYWRIGHT_PAGE__;
}

function createClientDriver(args: {
  readonly fidelity: OpenSimFidelity;
  readonly sim: Sim;
  readonly id: string;
}): Driver {
  const page = injectedPlaywrightPage();
  const baseUrl = process.env['PLAYWRIGHT_BASE_URL'];
  if (args.fidelity === 'max' && page !== undefined && baseUrl !== undefined) {
    return createDriver({ kind: 'playwright', page, baseUrl });
  }
  const live = args.sim.spawnClient(args.id);
  // Product keeps virtual sim timers (createSim default). Driver waits use wall
  // time so waitUntil deadlines progress; each sleep also advances the sim clock
  // so product setTimeout(0) / retries flush while polling.
  const timers: Timers = {
    setTimeout: (fn, ms) =>
      simNodeTimers.setTimeout(() => {
        try {
          args.sim.clock.advance(Math.max(0, ms));
        } catch {
          // clock may have been reset/disposed mid-wait
        }
        fn();
      }, ms),
    clearTimeout: simNodeTimers.clearTimeout,
    setInterval: (fn, ms) =>
      simNodeTimers.setInterval(() => {
        try {
          args.sim.clock.advance(Math.max(0, ms));
        } catch {
          // ignore
        }
        fn();
      }, ms),
    clearInterval: simNodeTimers.clearInterval,
  };
  return createDriver({
    kind: 'in-process',
    now: wallClock.now,
    timers,
    harness: {
      mount: async () => {
        // Isolated nav tree — URL linking suspends forever under Jest/RNTL.
        const result = render(createElement(live.App, { embedded: true }));
        args.sim.clock.advance(0);
        return createRenderedAppFromRntl(result);
      },
    },
  });
}

async function postgresServerSql(): Promise<SimSqlHandle> {
  const { ensureMaxFidelityStack } = await import('./max-fidelity-stack');
  const { bootSimPostgres } = await import('./boot-sim-postgres');
  await ensureMaxFidelityStack();
  const pg = await bootSimPostgres();
  const shared = sharedSqlClient(pg.sqlClient);
  return {
    get sqlClient() {
      return shared;
    },
    databaseName: 'sim_postgres',
    disconnect: () => pg.stop(),
    reset: async () => undefined,
    exportBytes: async () => new Uint8Array(),
    importBytes: async () => undefined,
  };
}

async function bootSim(
  testId: string,
  fidelity: OpenSimFidelity
): Promise<{
  readonly sim: Sim;
  readonly reporter: SimulationReporter;
}> {
  const sim = await createSim({
    seed: 1,
    startMs: Date.parse('2024-06-01T00:00:00.000Z'),
    // Keep virtual sim timers on the product — wall timers here stick RNTL
    // `act` on product setIntervals (reconcile / ping). Driver waits use wall
    // time in createClientDriver and advance this clock while sleeping.
    ...(fidelity === 'max' ? { serverSql: await postgresServerSql() } : {}),
  });
  await sim.spawnServer();
  const reporter = new SimulationReporter({
    seed: '1',
    store: reportStore,
    runId: await resolveProcessRunId(),
    testId,
    now: () => wallClock.now(),
    maxFramesPerStep: 1,
    frameIntervalMs: 250,
    publishThrottleMs: 50,
    ui: process.env['PLAYWRIGHT_BASE_URL'] ? 'playwright' : 'in-process',
    snapshotDatabases: () => snapshotSimDatabases(sim),
    snapshotCheckpoint: () => snapshotSimCheckpoint(sim, wallClock.now()),
    snapshotTopology: () => projectReportTopology(simReportTopology(sim), '1'),
  });
  return { sim, reporter };
}

export async function openSim(
  testId: string,
  options?: OpenSimOptions
): Promise<OpenSimHandle> {
  const fidelity = resolveOpenSimFidelity(options);
  const { sim, reporter } = await bootSim(testId, fidelity);
  const actors = new Map<string, SimActorHandle>();
  let disposed = false;

  const handle: OpenSimHandle = {
    sim,
    fidelity,
    async actor(id: string) {
      if (disposed) throw new Error('openSim: already disposed');
      const existing = actors.get(id);
      if (existing) return existing;
      const raw = createClientDriver({ fidelity, sim, id });
      const ui = createReportingDriver(raw, {
        actorId: id,
        reporter,
      });
      await ui.launch();
      const actor = { id, ui };
      actors.set(id, actor);
      return actor;
    },
    async dispose() {
      if (disposed) return;
      disposed = true;
      for (const a of actors.values()) {
        try {
          await a.ui.close();
        } catch {
          // ignore teardown races
        }
      }
      actors.clear();
      try {
        await reporter.flush();
      } catch {
        // report flush should not mask sim teardown
      }
      await sim.dispose();
    },
    async [Symbol.asyncDispose]() {
      await handle.dispose();
    },
  };
  return handle;
}
