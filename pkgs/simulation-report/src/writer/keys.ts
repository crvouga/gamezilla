/** Object-store key layout for one report bucket. */

export const RUNS_INDEX_KEY = 'runs/index.json';
export const GENERATION_KEY = 'runs/generation';

export function runPrefix(runId: string): string {
  return `runs/${runId}`;
}

export function runManifestKey(runId: string): string {
  return `${runPrefix(runId)}/manifest.json`;
}

export function snapshotShellKey(runId: string): string {
  return `${runPrefix(runId)}/snapshot-shell.css`;
}

export function testStepsKey(runId: string, testId: string): string {
  return `${runPrefix(runId)}/tests/${testId}/steps.json`;
}

export function testFrameKey(
  runId: string,
  testId: string,
  frameFile: string
): string {
  const rel = frameFile.replace(/^\/+/, '');
  return `${runPrefix(runId)}/tests/${testId}/${rel}`;
}
