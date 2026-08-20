import type { ObjectStore } from '@pkgs/object-store/interface';

import type { RunsIndex, SimulationReportData, SimulationStep } from '../types';
import {
  RUNS_INDEX_KEY,
  runManifestKey,
  snapshotShellKey,
  testFrameKey,
  testStepsKey,
} from './keys';
import {
  bumpGeneration,
  loadRunManifest,
  loadRunsIndex,
  storeGetJson,
  storePutJson,
} from './store-io';

export type PruneOptions = {
  readonly keepLast?: number;
  readonly olderThanMs?: number;
  /** Wall/sim clock for olderThanMs comparison. */
  readonly nowMs: number;
};

/**
 * Delete one run's known keys (index + manifest + per-test steps/frames + shell).
 */
export async function deleteRun(
  store: ObjectStore,
  runId: string
): Promise<void> {
  const manifest = await loadRunManifest(store, runId);
  for (const test of manifest.tests) {
    const steps = await storeGetJson<SimulationReportData>(
      store,
      testStepsKey(runId, test.testId)
    );
    if (steps) {
      for (const step of steps.steps) {
        await deleteStepFrames(store, runId, test.testId, step);
      }
    }
    await store.delete(testStepsKey(runId, test.testId));
  }
  await store.delete(runManifestKey(runId));
  await store.delete(snapshotShellKey(runId));

  const index = await loadRunsIndex(store);
  const runs = index.runs.filter((r) => r.id !== runId);
  await storePutJson(store, RUNS_INDEX_KEY, { runs } satisfies RunsIndex);
  await bumpGeneration(store);
}

async function deleteStepFrames(
  store: ObjectStore,
  runId: string,
  testId: string,
  step: SimulationStep
): Promise<void> {
  const files = new Set<string>();
  if (step.snapshotFile) files.add(step.snapshotFile);
  for (const frame of step.frames ?? []) {
    files.add(frame.file);
  }
  for (const file of files) {
    await store.delete(testFrameKey(runId, testId, file));
  }
}

/**
 * Prune runs by keep-last and/or age. Returns deleted run ids.
 */
export async function pruneRuns(
  store: ObjectStore,
  options: PruneOptions
): Promise<readonly string[]> {
  const index = await loadRunsIndex(store);
  const sorted = [...index.runs].sort((a, b) => b.updatedAtMs - a.updatedAtMs);
  const toDelete = new Set<string>();

  if (options.keepLast !== undefined && options.keepLast >= 0) {
    for (const run of sorted.slice(options.keepLast)) {
      toDelete.add(run.id);
    }
  }
  if (options.olderThanMs !== undefined) {
    const cutoff = options.nowMs - options.olderThanMs;
    for (const run of sorted) {
      if (run.updatedAtMs < cutoff) toDelete.add(run.id);
    }
  }

  const deleted: string[] = [];
  for (const id of toDelete) {
    await deleteRun(store, id);
    deleted.push(id);
  }
  return deleted;
}
