/**
 * Open a client UI simulation on `@pkgs/system` createWorld + product implements.
 */

import { system } from '@libs/runtime/shared/system';
import { wallClock } from '@pkgs/clock';
import { createSimIo } from '@pkgs/io';
import { readUtf8, writeUtf8 } from '@pkgs/object-store/helpers';
import { createNodeFsObjectStore } from '@pkgs/object-store/impl-node-fs';
import { wallNodeFs } from '@pkgs/object-store/wall-node-fs';
import { createWorld, instanceAddress, type World } from '@pkgs/system';
import {
  createReportingDriver,
  mintRunId,
  resolveLocalReportDataDir,
  SimulationReporter,
  wallPathExists,
} from '@pkgs/system-console';
import type { Driver } from '@pkgs/ui-testing';
import { bootMigratedSimSqlite, type SimSqliteHandle } from './boot-sim-sqlite';
import {
  type OpenSimFidelity,
  type OpenSimOptions,
  resolveOpenSimFidelity,
} from './fidelity';
import { migrateSimSqlite } from './migrate-sim-sqlite';
import { createProductImpls } from './product-impls';
import { createInMemoryBus, createProductProvide } from './product-provide';
import { simNodeTimers } from './sim-actor-overrides';

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
  readonly world: World;
  readonly fidelity: OpenSimFidelity;
  actor(id: string): Promise<SimActorHandle>;
  dispose(): Promise<void>;
  [Symbol.asyncDispose](): Promise<void>;
};

type BootedDb = {
  stop(): Promise<void>;
  snapshotApiBytes(): Uint8Array;
};

type BootedSim = {
  readonly world: World;
  readonly db: BootedDb;
  readonly reporter: SimulationReporter;
};

async function bootSqliteDb(): Promise<SimSqliteHandle> {
  const io = createSimIo({
    seed: 1,
    startMs: Date.parse('2024-06-01T00:00:00.000Z'),
  });
  const { handle: db } = await bootMigratedSimSqlite({
    migrate: async (handle) => {
      await migrateSimSqlite({
        sqlClient: handle.sqlClient,
        io: {
          ...io,
          clock: { now: () => wallClock.now() },
          timers: simNodeTimers,
        },
      });
    },
  });
  return db;
}

async function bootSim(
  testId: string,
  fidelity: OpenSimFidelity
): Promise<BootedSim> {
  const pubSubBus = createInMemoryBus();
  let sqlClient: import('@pkgs/sql-client/interface').SqlClient;
  let openRequestDb: import('@apps/api/db/open-request-db').OpenRequestDb;
  let db: BootedDb;

  if (fidelity === 'max') {
    const { ensureMaxFidelityStack } = await import('./max-fidelity-stack');
    const { bootSimPostgres } = await import('./boot-sim-postgres');
    await ensureMaxFidelityStack();
    const pg = await bootSimPostgres();
    sqlClient = pg.sqlClient;
    openRequestDb = pg.openRequestDb;
    db = {
      stop: () => pg.stop(),
      snapshotApiBytes: () => new Uint8Array(),
    };
  } else {
    const sqlite = await bootSqliteDb();
    sqlClient = sqlite.sqlClient;
    openRequestDb = sqlite.openRequestDb;
    db = {
      stop: () => sqlite.stop(),
      snapshotApiBytes: () => new Uint8Array(sqlite.sqlite.serialize()),
    };
  }

  const world = createWorld(system, {
    seed: 1,
    timers: simNodeTimers,
    impls: createProductImpls({ pubSubBus, fidelity }),
    provide: createProductProvide({ sqlClient, openRequestDb, pubSubBus }),
    startMs: Date.parse('2024-06-01T00:00:00.000Z'),
  });
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
    world,
    snapshotDatabases: async () => [
      { nodeId: 'api', bytes: db.snapshotApiBytes() },
    ],
  });
  return { world, db, reporter };
}

function buildOpenSimHandle(
  boot: BootedSim,
  fidelity: OpenSimFidelity
): OpenSimHandle {
  const { world, db, reporter } = boot;
  const actors = new Map<string, SimActorHandle>();
  let disposed = false;

  const handle: OpenSimHandle = {
    world,
    fidelity,
    async actor(id: string) {
      if (disposed) throw new Error('openSim: already disposed');
      const existing = actors.get(id);
      if (existing) return existing;
      const address = instanceAddress('client', id);
      const raw = await world.spawn<Driver>('client', id);
      const ui = createReportingDriver(raw, {
        actorId: address,
        reporter,
      });
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
      world.dispose();
      await db.stop();
    },
    async [Symbol.asyncDispose]() {
      await handle.dispose();
    },
  };
  return handle;
}

export async function openSim(
  testId: string,
  options?: OpenSimOptions
): Promise<OpenSimHandle> {
  const fidelity = resolveOpenSimFidelity(options);
  const boot = await bootSim(testId, fidelity);
  const handle = buildOpenSimHandle(boot, fidelity);
  await boot.world.spawn('api');
  return handle;
}
