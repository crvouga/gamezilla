/**
 * Open a client UI simulation via framework `openWorld(defineProductSystem)`.
 */

import { type Timers, wallClock } from '@pkgs/clock';
import { openWorld, type World } from '@pkgs/determinism';
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
import {
  type CreateSimOptions,
  type Sim,
  simClientNamespace,
} from '@sim/console/sim/create-sim';
import { type SimSqlHandle, sharedSqlClient } from '@sim/console/sim/sim-sql';
import {
  restoreSystemSnapshot,
  type SystemSnapshotCtx,
} from '@sim/console/sim/system-snapshot';
import { createElement } from 'react';

import '@apps/client/i18n/i18n';

import type { SimSystemSnapshot } from '@pkgs/sim-console/shared/sim-system-snapshot';
import { resolveSimSqlBackend } from '@sim/console/sim/sim-sql-backend';
import { defineProductSystem, type ProductSystem, requireSim } from '../system';
import { ensureSimPgliteSeed } from './boot-sim-pglite';
import { ensureSimPostgresMemSeed } from './boot-sim-postgres-mem';
import {
  type OpenSimFidelity,
  type OpenSimOptions,
  resolveOpenSimFidelity,
} from './fidelity';
import { ensureNodeLocalStoragePolyfill } from './node-local-storage-polyfill';
import { injectPlaywrightSnapshotAuth } from './playwright-snapshot-auth';
import { simNodeTimers } from './sim-actor-overrides';
import { readSimSystemSnapshot } from './sim-snapshot-fixture';
import { createSerializedRunFor, createSimWaitPump } from './sim-wait-pump';
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
 * Wipe happens once in `jest.global-setup.cjs` when `SIM_REPORT` is on
 * (not per openSim / test file; skipped when reports are off).
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
  /** Drop the RNTL focus without closing sim clients. */
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
  readonly runFor: (durationMs: number) => Promise<void>;
}): Driver {
  const page = injectedPlaywrightPage();
  const baseUrl = process.env['PLAYWRIGHT_BASE_URL'];
  if (args.fidelity === 'max' && page !== undefined && baseUrl !== undefined) {
    return createDriver({ kind: 'playwright', page, baseUrl });
  }
  const live = args.sim.spawnClient(args.id);
  // Product keeps virtual sim timers (createSim default). Driver wait deadlines
  // use wall time as a fail-fast backstop; the drain pump advances the sim
  // clock (one-shots / reconcile) without wall 50ms sleeps.
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
        const app = args.multiAppSession.mountActor(
          args.id,
          createElement(live.App, { embedded: true })
        );
        await args.runFor(0);
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

async function bootSim(fidelity: OpenSimFidelity): Promise<{
  readonly sim: Sim;
  readonly host: World<ProductSystem>;
}> {
  const startMs = Date.parse('2024-06-01T00:00:00.000Z');
  const backend = resolveSimSqlBackend();
  // Keep virtual sim timers on the product — wall timers here stick RNTL
  // `act` on product setIntervals (reconcile / ping). Driver waits use wall
  // time in createClientDriver and advance this clock while sleeping.
  const createOpts: CreateSimOptions = {
    seed: 1,
    startMs,
    ...(fidelity === 'max'
      ? { serverSql: await postgresServerSql() }
      : {
          serverSqlSeedBytes:
            backend === 'mem'
              ? (await ensureSimPostgresMemSeed()).seedBytes
              : (await ensureSimPgliteSeed()).seedBytes,
        }),
  };
  const system = defineProductSystem(createOpts);
  const host = await openWorld(system, { seed: 1, startMs });
  return { sim: requireSim(host.system), host };
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
    ui: process.env['PLAYWRIGHT_BASE_URL'] ? 'playwright' : 'rntl',
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
  readonly runFor: (durationMs: number) => Promise<void>;
  readonly snapshot?: SimSystemSnapshot;
}): Promise<ActorEntry> {
  const raw = createClientDriver({
    fidelity: args.fidelity,
    sim: args.sim,
    id: args.id,
    multiAppSession: args.multiAppSession,
    runFor: args.runFor,
  });
  const page = injectedPlaywrightPage();
  const baseUrl = process.env['PLAYWRIGHT_BASE_URL'];
  if (
    args.snapshot !== undefined &&
    args.fidelity === 'max' &&
    page !== undefined &&
    baseUrl !== undefined
  ) {
    await injectPlaywrightSnapshotAuth({
      page,
      actorId: args.id,
      snapshot: args.snapshot,
      namespace: simClientNamespace(args.id),
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
  readonly host: World<ProductSystem>;
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
    } catch (err) {
      // Report flush should not mask sim teardown, but silent loss leaves the
      // console showing a prior FAILED run after a green Jest pass.
      console.error(
        '[openSim] report flush failed:',
        err instanceof Error ? err.message : err
      );
    }
  }
  // Framework world dispose → product.sim node dispose → sim.dispose().
  // Host + sim dispose are both idempotent (safe if called twice).
  await args.host.dispose();
  // auth client schedules a wall 10ms setTimeout after auth routes
  // (session-signal flip). Nanostores STORE_UNMOUNT_DELAY (1000ms) is unref'd
  // in jest.setup-env so it does not keep Jest alive after this short drain.
  await new Promise<void>((resolve) => {
    simNodeTimers.setTimeout(resolve, 50);
  });
}

export async function openSim(
  testId: string,
  options?: OpenSimOptions
): Promise<OpenSimHandle> {
  ensureNodeLocalStoragePolyfill();
  const fidelity = resolveOpenSimFidelity(options);
  const { sim, host } = await bootSim(fidelity);
  const clientSqlByAddress = new Map<string, SimSqlHandle>();
  const liveClients = new Map<string, ReturnType<Sim['spawnClient']>>();
  let loadedSnapshot: SimSystemSnapshot | undefined;
  if (options?.snapshot !== undefined) {
    loadedSnapshot = readSimSystemSnapshot(options.snapshot);
    const snapshotCtx: SystemSnapshotCtx = {
      sim,
      clientIds: loadedSnapshot.clientIds,
      liveClients,
      clientSqlByAddress,
    };
    await restoreSystemSnapshot(snapshotCtx, loadedSnapshot);
  }
  const actors = new Map<string, ActorEntry>();
  const runFor = createSerializedRunFor(sim.scheduler);
  const multiAppSession = createMultiAppRntlSession({
    onActorFocus: () => {
      // Nudge product timers (upload idle / reconcile) after remount.
      void runFor(1_000).catch(() => {
        // ignore disposed clock
      });
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
        runFor,
        ...(loadedSnapshot !== undefined ? { snapshot: loadedSnapshot } : {}),
      });
      liveClients.set(id, sim.spawnClient(id));
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
      liveClients.delete(id);
      sim.bumpClientEpoch();
    },
    async dispose() {
      if (disposed) return;
      disposed = true;
      await disposeOpenSim({ actors, multiAppSession, reporter, host });
    },
    async [Symbol.asyncDispose]() {
      await handle.dispose();
    },
  };
  return handle;
}
