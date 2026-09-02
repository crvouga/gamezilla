/**
 * Open a client UI simulation via framework `openWorld(defineProductSystem)`.
 */

import { type Timers, wallClock } from '@pkgs/clock';
import { openWorld } from '@pkgs/dst';
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
import type { Driver, UiTestCtx } from '@pkgs/ui-testing';
import { createDriver, getUiTestBrowser } from '@pkgs/ui-testing';
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

import '@apps/client/i18n/i18n';

import type { SimSystemSnapshot } from '@pkgs/sim-console/shared/sim-system-snapshot';
import { resolveSimSqlBackend } from '@sim/console/sim/sim-sql-backend';
import { defineProductSystem, type ProductSystemWorld } from '../scenario';
import { ensureSimPgliteSeed } from './boot-sim-pglite';
import { ensureSimPostgresMemSeed } from './boot-sim-postgres-mem';
import {
  type OpenSimFidelity,
  type OpenSimOptions,
  resolveOpenSimFidelity,
} from './fidelity';
import { ensureNodeLocalStoragePolyfill } from './node-local-storage-polyfill';
import { injectPlaywrightSnapshotAuth } from './playwright-snapshot-auth';
import { seedSimChessPuzzles } from './seed-sim-chess-puzzles';
import { simNodeTimers } from './sim-actor-overrides';
import { listenSimHttpServer, type SimHttpListener } from './sim-http-listener';
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

const STATIC_REPORT_RUN_ID = 'latest_run';
const FRAME_STYLESHEET_HREF = '../../snapshot-shell.css';

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
  readonly driverKind: UiTestCtx['driverKind'];
  actor(id: string): Promise<SimActorHandle>;
  clearUiFocus(): void;
  resetActor(id: string): Promise<void>;
  dispose(): Promise<void>;
  [Symbol.asyncDispose](): Promise<void>;
};

type ResolvedOpenSimArgs = {
  readonly testId: string;
  readonly ctx: UiTestCtx | undefined;
  readonly options: OpenSimOptions | undefined;
  readonly fidelity: OpenSimFidelity;
  readonly driverKind: UiTestCtx['driverKind'];
};

function isUiTestCtx(value: unknown): value is UiTestCtx {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record['fidelity'] === 'string' &&
    typeof record['driverKind'] === 'string' &&
    typeof record['test'] === 'function'
  );
}

function resolveOpenSimArgs(
  testId: string,
  ctxOrOptions?: UiTestCtx | OpenSimOptions,
  maybeOptions?: OpenSimOptions
): ResolvedOpenSimArgs {
  const ctx =
    ctxOrOptions !== undefined && isUiTestCtx(ctxOrOptions)
      ? ctxOrOptions
      : undefined;
  const options =
    ctx !== undefined
      ? maybeOptions
      : (ctxOrOptions as OpenSimOptions | undefined);
  const fidelity = ctx?.fidelity ?? resolveOpenSimFidelity(options);
  const driverKind =
    ctx?.driverKind ?? (fidelity === 'max' ? 'playwright' : 'rntl');
  return { testId, ctx, options, fidelity, driverKind };
}

type MultiAppRntlSession = ReturnType<
  typeof import('@pkgs/ui-testing')['createMultiAppRntlSession']
>;

function loadRntlSessionFactory(): typeof import('@pkgs/ui-testing')['createMultiAppRntlSession'] {
  return require('@pkgs/ui-testing').createMultiAppRntlSession;
}

function createRntlClientDriver(args: {
  readonly sim: Sim;
  readonly id: string;
  readonly multiAppSession: MultiAppRntlSession;
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

  const driver = createDriver({
    kind: 'playwright',
    page,
    baseUrl,
  });

  return {
    driver,
    page,
    close: async () => {
      await context.close();
    },
  };
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
  readonly host: ProductSystemWorld;
}> {
  const startTime = Date.parse('2024-06-01T00:00:00.000Z');
  const backend = resolveSimSqlBackend();
  const createOpts: CreateSimOptions = {
    seed: 1,
    startTime,
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
  const host = await openWorld(system, { seed: 1, startTime });
  // Live insert (not dump): postgres-mem PGMM round-trip corrupts int8 so
  // `WHERE rating …` on dump-seeded chess_puzzles fails. Three rows are cheap.
  await seedSimChessPuzzles({ sqlClient: host.sim.serverSql.sqlClient });
  return { sim: host.sim, host };
}

function createSimReporter(args: {
  readonly testId: string;
  readonly sim: Sim;
  readonly driverKind: UiTestCtx['driverKind'];
  readonly multiAppSession: MultiAppRntlSession | null;
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
      if (args.multiAppSession === null) return [];
      const snapshots = await args.multiAppSession.snapshotAllActors({
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
  readonly closeResources: () => Promise<void>;
};

async function launchActor(args: {
  readonly driverKind: UiTestCtx['driverKind'];
  readonly sim: Sim;
  readonly id: string;
  readonly multiAppSession: MultiAppRntlSession | null;
  readonly reporter: SimulationReporter | null;
  readonly runFor: (durationMs: number) => Promise<void>;
  readonly snapshot?: SimSystemSnapshot;
}): Promise<ActorEntry> {
  let raw: Driver;
  let closeResources: () => Promise<void> = async () => undefined;

  if (args.driverKind === 'playwright') {
    const pw = await createPlaywrightClientDriver({
      id: args.id,
      ...(args.snapshot !== undefined ? { snapshot: args.snapshot } : {}),
    });
    raw = pw.driver;
    closeResources = pw.close;
  } else {
    if (args.multiAppSession === null) {
      throw new Error('openSim rntl: multi-app session required');
    }
    raw = createRntlClientDriver({
      sim: args.sim,
      id: args.id,
      multiAppSession: args.multiAppSession,
      runFor: args.runFor,
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

async function closeActorEntry(entry: ActorEntry): Promise<void> {
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

async function disposeOpenSim(args: {
  readonly actors: Map<string, ActorEntry>;
  readonly multiAppSession: MultiAppRntlSession | null;
  readonly reporter: SimulationReporter | null;
  readonly host: ProductSystemWorld;
  readonly httpListener: SimHttpListener | null;
}): Promise<void> {
  for (const a of args.actors.values()) {
    await closeActorEntry(a);
  }
  args.actors.clear();
  args.multiAppSession?.dispose();
  if (args.httpListener !== null) {
    await args.httpListener.stop();
  }
  if (args.reporter !== null) {
    try {
      await args.reporter.flush();
      await writeKeysIndex();
    } catch (err) {
      console.error(
        '[openSim] report flush failed:',
        err instanceof Error ? err.message : err
      );
    }
  }
  await args.host.dispose();
  await new Promise<void>((resolve) => {
    simNodeTimers.setTimeout(resolve, 50);
  });
}

type OpenSimContext = {
  readonly sim: Sim;
  readonly host: ProductSystemWorld;
  readonly fidelity: OpenSimFidelity;
  readonly driverKind: UiTestCtx['driverKind'];
  readonly httpListener: SimHttpListener | null;
  readonly actors: Map<string, ActorEntry>;
  readonly liveClients: Map<string, ReturnType<Sim['spawnClient']>>;
  readonly multiAppSession: MultiAppRntlSession | null;
  readonly reporter: SimulationReporter | null;
  readonly runFor: (durationMs: number) => Promise<void>;
  readonly loadedSnapshot: SimSystemSnapshot | undefined;
};

async function createOpenSimContext(
  resolved: ResolvedOpenSimArgs
): Promise<OpenSimContext> {
  const { fidelity, driverKind, options } = resolved;
  const { sim, host } = await bootSim(fidelity);

  let httpListener: SimHttpListener | null = null;
  if (driverKind === 'playwright') {
    httpListener = await listenSimHttpServer(sim);
  }

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

  let multiAppSession: MultiAppRntlSession | null = null;
  if (driverKind === 'rntl') {
    multiAppSession = loadRntlSessionFactory()({
      onActorFocus: () => {
        void runFor(1_000).catch(() => undefined);
      },
    });
  }

  if (simReportEnabled()) {
    await reportFs.mkdir(reportDataDir, { recursive: true });
  }
  const reporter = createSimReporter({
    testId: resolved.testId,
    sim,
    driverKind,
    multiAppSession,
  });

  return {
    sim,
    host,
    fidelity,
    driverKind,
    httpListener,
    actors,
    liveClients,
    multiAppSession,
    reporter,
    runFor,
    loadedSnapshot,
  };
}

function buildOpenSimHandle(ctx: OpenSimContext): OpenSimHandle {
  let disposed = false;

  const handle: OpenSimHandle = {
    sim: ctx.sim,
    fidelity: ctx.fidelity,
    driverKind: ctx.driverKind,
    async actor(id: string) {
      if (disposed) throw new Error('openSim: already disposed');
      const existing = ctx.actors.get(id);
      if (existing) return existing.handle;
      const entry = await launchActor({
        driverKind: ctx.driverKind,
        sim: ctx.sim,
        id,
        multiAppSession: ctx.multiAppSession,
        reporter: ctx.reporter,
        runFor: ctx.runFor,
        ...(ctx.loadedSnapshot !== undefined
          ? { snapshot: ctx.loadedSnapshot }
          : {}),
      });
      if (ctx.driverKind === 'rntl') {
        ctx.liveClients.set(id, ctx.sim.spawnClient(id));
      }
      ctx.actors.set(id, entry);
      return entry.handle;
    },
    clearUiFocus() {
      ctx.multiAppSession?.clearFocus();
    },
    async resetActor(id: string) {
      if (disposed) return;
      const existing = ctx.actors.get(id);
      if (existing !== undefined) {
        await closeActorEntry(existing);
        ctx.actors.delete(id);
      }
      await ctx.sim.dropClient(id);
      ctx.liveClients.delete(id);
      ctx.sim.bumpClientEpoch();
    },
    async dispose() {
      if (disposed) return;
      disposed = true;
      await disposeOpenSim({
        actors: ctx.actors,
        multiAppSession: ctx.multiAppSession,
        reporter: ctx.reporter,
        host: ctx.host,
        httpListener: ctx.httpListener,
      });
    },
    async [Symbol.asyncDispose]() {
      await handle.dispose();
    },
  };
  return handle;
}

export async function openSim(
  testId: string,
  ctxOrOptions?: UiTestCtx | OpenSimOptions,
  maybeOptions?: OpenSimOptions
): Promise<OpenSimHandle> {
  const resolved = resolveOpenSimArgs(testId, ctxOrOptions, maybeOptions);
  ensureNodeLocalStoragePolyfill();
  const ctx = await createOpenSimContext(resolved);
  return buildOpenSimHandle(ctx);
}
