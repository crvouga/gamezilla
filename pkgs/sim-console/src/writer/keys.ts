/** Object-store key layout for one report bucket. */

import { testReportKey } from '@pkgs/sim';

export {
  GENERATION_KEY,
  RUNS_INDEX_KEY,
  runManifestKey,
  runPrefix,
  testFrameKey,
  testReportKey,
} from '@pkgs/sim';

export function snapshotShellKey(runId: string): string {
  return `runs/${runId}/snapshot-shell.css`;
}

/** @deprecated Prefer {@link testReportKey}. */
export function testStepsKey(runId: string, testId: string): string {
  return testReportKey(runId, testId);
}

export function testEventsKey(runId: string, testId: string): string {
  return `runs/${runId}/tests/${testId}/events.json`;
}

export function testTopologyKey(runId: string, testId: string): string {
  return `runs/${runId}/tests/${testId}/topology.json`;
}
