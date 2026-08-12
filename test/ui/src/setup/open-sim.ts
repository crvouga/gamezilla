/**
 * Open a client UI simulation with the shared report store + timing defaults.
 *
 * All `openSim` calls in one Jest process share a single simulation-report
 * `runId` (so the suite appears as one run with many tests). Override with
 * `SIM_REPORT_RUN_ID` when composing across processes.
 *
 * Jest isolates the module registry and `globalThis` per test file, so the
 * shared id is persisted under the report data dir keyed by `process.pid`.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { wallClock } from '@pkgs/clock';
import { createNodeFsObjectStore } from '@pkgs/object-store/impl-node-fs';
import { Simulation } from '@pkgs/simulation';
import { mintRunId, resolveLocalReportDataDir } from '@pkgs/simulation-report';

import { ClientSimulationSystem } from './client-simulation-system';

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
  writeFileSync(
    path,
    `${JSON.stringify({ pid: process.pid, runId } satisfies RunMarker)}\n`,
    'utf8'
  );
  return runId;
}

export async function openSim(
  testId: string
): Promise<Awaited<ReturnType<typeof Simulation.open>>> {
  return await Simulation.open({
    seed: 1,
    startMs: Date.parse('2024-06-01T00:00:00.000Z'),
    system: new ClientSimulationSystem(),
    report: {
      store: reportStore,
      runId: resolveProcessRunId(),
      testId,
      now: () => wallClock.now(),
      maxFramesPerStep: 1,
      frameIntervalMs: 250,
      // Mid-run report publish coalesce — lower than default to cut FS work;
      // driver wait polls stay on the Driver wait interval, not this value.
      publishThrottleMs: 50,
    },
  });
}
