import type { ObjectStore } from '@pkgs/object-store/interface';

import type {
  RunSummary,
  SimulationReportEvent,
  SimulationReportTopology,
  SimulationStepStatus,
  SuiteTestSummary,
} from '../types';
import { RUNS_INDEX_KEY, testEventsKey, testTopologyKey } from './keys';
import { loadRunsIndex, storePutJson } from './store-io';

export async function publishTopologyAndEvents(args: {
  readonly store: ObjectStore;
  readonly runId: string;
  readonly testId: string;
  readonly snapshotEvents?: () => readonly SimulationReportEvent[];
  readonly snapshotTopology?: () => SimulationReportTopology;
}): Promise<void> {
  if (args.snapshotEvents) {
    await storePutJson(
      args.store,
      testEventsKey(args.runId, args.testId),
      args.snapshotEvents()
    );
  }
  if (args.snapshotTopology) {
    await storePutJson(
      args.store,
      testTopologyKey(args.runId, args.testId),
      args.snapshotTopology()
    );
  }
}

export async function rewriteRunsIndex(args: {
  readonly store: ObjectStore;
  readonly runId: string;
  readonly tests: readonly SuiteTestSummary[];
  readonly updatedAtMs: number;
}): Promise<void> {
  const index = await loadRunsIndex(args.store);
  const status: SimulationStepStatus = args.tests.some(
    (t) => t.status === 'failed'
  )
    ? 'failed'
    : 'passed';
  const summary: RunSummary = {
    id: args.runId,
    updatedAtMs: args.updatedAtMs,
    status,
    testCount: args.tests.length,
    frameCount: args.tests.reduce((n, t) => n + t.frameCount, 0),
  };
  const runs = index.runs.filter((r) => r.id !== args.runId);
  runs.push(summary);
  runs.sort((a, b) => b.updatedAtMs - a.updatedAtMs);
  await storePutJson(args.store, RUNS_INDEX_KEY, { runs });
}
