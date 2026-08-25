/**
 * Open a client UI simulation on createSim.
 */

import { type Timers, wallClock } from '@pkgs/clock';
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
import type { Driver } from '@pkgs/ui-testing';
import { createDriver, createMultiAppRntlSession } from '@pkgs/ui-testing';
import type { Page } from '@playwright/test';
import { createSim, type Sim } from '@sim/console/sim/create-sim';
import { type SimSqlHandle, sharedSqlClient } from '@sim/console/sim/sim-sql';
import { createElement } from 'react';

import '@apps/client/i18n/i18n';

import { resolveSimSqlBackend } from '@sim/console/sim/sim-sql-backend';
import { ensureSimPgliteSeed } from './boot-sim-pglite';
import { ensureSimPostgresMemSeed } from './boot-sim-postgres-mem';
import {
  type OpenSimFidelity,
  type OpenSimOptions,
  resolveOpenSimFidelity,
} from './fidelity';
import { simNodeTimers } from './sim-actor-overrides';
import { simReportTopology } from './sim-world-snapshot';

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

/**
 * Fixed on-disk run id for the static console dump. Must not be the SPA alias
 * `latest` — sanitizeRunId remaps that reserved id to `latest_run`.
 * Wipe happens once in `jest.global-setup.cjs` (not per openSim / test file).
 */
const STATIC_REPORT_RUN_ID = 'latest_run';

/** Relative to `tests/<id>/frames/` → run `snapshot-shell.css`. */
const FRAME_STYLESHEET_HREF = '../../snapshot-shell.css';

/** HTML dumps for sim console. Off only when `SIM_REPORT=0`. */
function simReportEnabled(): boolean {
  return process.env['SIM_REPORT'] !== '0';
}

async function writeKeysIndex(): Promise<void> {
  const keys = await reportStore.listKeys();
  await writeUtf8(
    reportStore,
    'keys.json',
    JSON.stringify(keys),
    'application/json'
  );
}

export type SimActorHandle = {
  readonly id: string;
  readonly ui: Driver;
};

export type OpenSimHandle = {
  readonly sim: Sim;
  readonly fidelity: OpenSimFidelity;
  actor(id: string): Promise<SimActorHandle>;
  /** Drop the in-process RNTL focus without closing sim clients. */
  clearUiFocus(): void;
  /**
   * Close UI + client for `id` and bump durable client epoch so the next
   * {@link actor} call mounts a fresh client SQL namespace (shared server).
   */
  resetActor(id: string): Promise<void>;
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
  readonly multiAppSession: ReturnType<typeof createMultiAppRntlSession>;
}): Driver {
  const page = injectedPlaywrightPage();
  const baseUrl = process.env['PLAYWRIGHT_BASE_URL'];
  if (args.fidelity === 'max' && page !== undefined && baseUrl !== undefined) {
    return createDriver({ kind: 'playwright', page, baseUrl });
  }
  const live = args.sim.spawnClient(args.id);
  // Product keeps virtual sim timers (createSim default). Poll sleeps use a
  // short wall delay so waitUntil does not burn 50ms real time per poll, but
  // only advance the sim clock by that same wall amount — advancing by the
  // full interval (e.g. 50ms) on a 1ms sleep races Better Auth past dispose.
  const timers: Timers = {
    setTimeout: (fn, ms) => {
      const wallMs = ms <= 0 ? 0 : Math.min(ms, 1);
      return simNodeTimers.setTimeout(() => {
        try {
          args.sim.clock.advance(wallMs);
        } catch {
          // clock may have been reset/disposed mid-wait
        }
        fn();
      }, wallMs);
    },
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
        const app = args.multiAppSession.mountActor(
          args.id,
          createElement(live.App, { embedded: true })
        );
        args.sim.clock.advance(0);
        return app;
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
  fidelity: OpenSimFidelity
): Promise<{ readonly sim: Sim }> {
  const startMs = Date.parse('2024-06-01T00:00:00.000Z');
  const backend = resolveSimSqlBackend();
  const sim = await createSim({
    seed: 1,
    startMs,
    // Keep virtual sim timers on the product — wall timers here stick RNTL
    // `act` on product setIntervals (reconcile / ping). Driver poll sleeps use
    // 1ms wall delay + full sim clock advance (see createClientDriver).
    ...(fidelity === 'max'
      ? { serverSql: await postgresServerSql() }
      : {
          serverSqlSeedBytes:
            backend === 'mem'
              ? (await ensureSimPostgresMemSeed()).seedBytes
              : (await ensureSimPgliteSeed()).seedBytes,
        }),
  });
  await sim.spawnServer();
  return { sim };
}

function createSimReporter(
  testId: string,
  sim: Sim,
  multiAppSession: ReturnType<typeof createMultiAppRntlSession>
): SimulationReporter | null {
  if (!simReportEnabled()) return null;
  return new SimulationReporter({
    seed: '1',
    store: reportStore,
    runId: STATIC_REPORT_RUN_ID,
    testId,
    now: () => wallClock.now(),
    maxFramesPerStep: 1,
    frameIntervalMs: 250,
    // Flush / failure only — Jest has no live report SSE watchers.
    publishThrottleMs: Number.POSITIVE_INFINITY,
    ui: process.env['PLAYWRIGHT_BASE_URL'] ? 'playwright' : 'in-process',
    snapshotTopology: () => projectReportTopology(simReportTopology(sim), '1'),
    snapshotViews: async () => {
      const snapshots = await multiAppSession.snapshotAllActors({
        stylesheetHref: FRAME_STYLESHEET_HREF,
      });
      return [...snapshots.entries()].map(([nodeId, html]) => ({
        nodeId,
        html,
      }));
    },
  });
}

type ActorEntry = {
  readonly handle: SimActorHandle;
  readonly raw: Driver;
};

async function launchActor(args: {
  readonly fidelity: OpenSimFidelity;
  readonly sim: Sim;
  readonly id: string;
  readonly multiAppSession: ReturnType<typeof createMultiAppRntlSession>;
  readonly reporter: SimulationReporter | null;
}): Promise<ActorEntry> {
  const raw = createClientDriver({
    fidelity: args.fidelity,
    sim: args.sim,
    id: args.id,
    multiAppSession: args.multiAppSession,
  });
  const ui =
    args.reporter === null
      ? raw
      : createReportingDriver(raw, {
          actorId: args.id,
          reporter: args.reporter,
        });
  await ui.launch();
  return { handle: { id: args.id, ui }, raw };
}

async function closeActorEntry(entry: ActorEntry): Promise<void> {
  try {
    await entry.raw.close();
  } catch {
    // ignore teardown races
  }
}

async function disposeOpenSim(args: {
  readonly actors: Map<string, ActorEntry>;
  readonly multiAppSession: ReturnType<typeof createMultiAppRntlSession>;
  readonly reporter: SimulationReporter | null;
  readonly sim: Sim;
}): Promise<void> {
  for (const a of args.actors.values()) {
    await closeActorEntry(a);
  }
  args.actors.clear();
  args.multiAppSession.dispose();
  if (args.reporter !== null) {
    try {
      await args.reporter.flush();
      await writeKeysIndex();
    } catch {
      // report flush should not mask sim teardown
    }
  }
  await args.sim.dispose();
}

export async function openSim(
  testId: string,
  options?: OpenSimOptions
): Promise<OpenSimHandle> {
  const fidelity = resolveOpenSimFidelity(options);
  const { sim } = await bootSim(fidelity);
  const actors = new Map<string, ActorEntry>();
  const multiAppSession = createMultiAppRntlSession({
    onActorFocus: () => {
      for (let i = 0; i < 20; i += 1) {
        sim.clock.advance(50);
      }
    },
  });
  if (simReportEnabled()) {
    await reportFs.mkdir(reportDataDir, { recursive: true });
  }
  const reporter = createSimReporter(testId, sim, multiAppSession);
  let disposed = false;

  const handle: OpenSimHandle = {
    sim,
    fidelity,
    async actor(id: string) {
      if (disposed) throw new Error('openSim: already disposed');
      const existing = actors.get(id);
      if (existing) return existing.handle;
      const entry = await launchActor({
        fidelity,
        sim,
        id,
        multiAppSession,
        reporter,
      });
      actors.set(id, entry);
      return entry.handle;
    },
    clearUiFocus() {
      multiAppSession.clearFocus();
    },
    async resetActor(id: string) {
      if (disposed) return;
      const existing = actors.get(id);
      if (existing !== undefined) {
        await closeActorEntry(existing);
        actors.delete(id);
      }
      await sim.dropClient(id);
      sim.bumpClientEpoch();
    },
    async dispose() {
      if (disposed) return;
      disposed = true;
      await disposeOpenSim({ actors, multiAppSession, reporter, sim });
    },
    async [Symbol.asyncDispose]() {
      await handle.dispose();
    },
  };
  return handle;
}
