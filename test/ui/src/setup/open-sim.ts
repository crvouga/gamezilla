/**
 * Open a client UI simulation on `@pkgs/system` createWorld + product implements.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { system } from '@libs/runtime/shared/system';
import { wallClock } from '@pkgs/clock';
import { createSimIo } from '@pkgs/io';
import { createNodeFsObjectStore } from '@pkgs/object-store/impl-node-fs';
import { createWorld, instanceAddress, type World } from '@pkgs/system';
import {
  createReportingDriver,
  mintRunId,
  resolveLocalReportDataDir,
  SimulationReporter,
} from '@pkgs/system-console';
import type { Driver } from '@pkgs/ui-testing';

import { bootMigratedSimSqlite, type SimSqliteHandle } from './boot-sim-sqlite';
import { migrateSimSqlite } from './migrate-sim-sqlite';
import { createProductImpls } from './product-impls';
import { createInMemoryBus, createProductProvide } from './product-provide';
import { simNodeTimers } from './sim-actor-overrides';
import { projectReportTopology } from './sim-topology';

const reportStore = createNodeFsObjectStore({
  rootDir: resolveLocalReportDataDir(),
});

type RunMarker = {
  readonly pid: number;
  readonly runId: string;
};

function runMarkerPath(): string {
  return join(resolveLocalReportDataDir(), '.jest-open-sim-run.json');
}

function resolveProcessRunId(): string {
  const fromEnv = process.env['SIM_REPORT_RUN_ID'];
  if (fromEnv !== undefined && fromEnv.length > 0) return fromEnv;

  const path = runMarkerPath();
  try {
    const marker = JSON.parse(readFileSync(path, 'utf8')) as RunMarker;
    if (marker.pid === process.pid && marker.runId.length > 0) {
      return marker.runId;
    }
  } catch {
    // Missing or corrupt — mint below.
  }

  const runId = mintRunId(wallClock.now());
  mkdirSync(resolveLocalReportDataDir(), { recursive: true });
  writeFileSync(
    path,
    `${JSON.stringify({ pid: process.pid, runId } satisfies RunMarker)}\n`,
    'utf8'
  );
  return runId;
}

export type SimActorHandle = {
  readonly id: string;
  readonly ui: Driver;
};

export type OpenSimHandle = {
  readonly world: World;
  actor(id: string): Promise<SimActorHandle>;
  dispose(): Promise<void>;
  [Symbol.asyncDispose](): Promise<void>;
};

type BootedSim = {
  readonly world: World;
  readonly db: SimSqliteHandle;
  readonly reporter: SimulationReporter;
};

async function bootSim(testId: string): Promise<BootedSim> {
  const io = createSimIo({
    seed: 1,
    startMs: Date.parse('2024-06-01T00:00:00.000Z'),
  });
  const pubSubBus = createInMemoryBus();
  const { handle: db } = await bootMigratedSimSqlite({
    migrate: async (handle) => {
      await migrateSimSqlite({
        sqlClient: handle.sqlClient,
        sqlite: handle.sqlite,
        io: {
          ...io,
          clock: { now: () => wallClock.now() },
          timers: simNodeTimers,
        },
      });
    },
  });
  const world = createWorld(system, {
    seed: 1,
    timers: simNodeTimers,
    impls: createProductImpls({ pubSubBus }),
    provide: createProductProvide({ db, pubSubBus }),
    startMs: Date.parse('2024-06-01T00:00:00.000Z'),
  });
  const reporter = new SimulationReporter({
    seed: '1',
    store: reportStore,
    runId: resolveProcessRunId(),
    testId,
    now: () => wallClock.now(),
    maxFramesPerStep: 1,
    frameIntervalMs: 250,
    publishThrottleMs: 50,
    ui: 'in-process',
    snapshotTopology: () => projectReportTopology(world, system, '1'),
    snapshotDatabases: async () => [
      { nodeId: 'api', bytes: new Uint8Array(db.sqlite.serialize()) },
    ],
  });
  return { world, db, reporter };
}

function buildOpenSimHandle(boot: BootedSim): OpenSimHandle {
  const { world, db, reporter } = boot;
  const actors = new Map<string, SimActorHandle>();
  let disposed = false;

  const handle: OpenSimHandle = {
    world,
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

export async function openSim(testId: string): Promise<OpenSimHandle> {
  const boot = await bootSim(testId);
  const handle = buildOpenSimHandle(boot);
  await boot.world.spawn('api');
  return handle;
}
