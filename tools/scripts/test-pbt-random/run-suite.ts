import { join } from 'node:path';

import { parallelMap } from './pool';
import { type FileRunResult, runPbtFile } from './run-file';
import type { PbtSessionUi } from './ui';

export type RunSuiteArgs = {
  readonly repoRoot: string;
  readonly files: readonly string[];
  readonly concurrency: number;
  readonly seed: number;
  readonly numRuns: number;
  readonly sampleInterruptMs: number;
  readonly ui: PbtSessionUi;
};

export type RunSuiteResult = {
  readonly ok: boolean;
  readonly results: readonly FileRunResult[];
  readonly durationMs: number;
};

export async function runPbtSuite(args: RunSuiteArgs): Promise<RunSuiteResult> {
  const started = Date.now();
  const results = await parallelMap(
    args.files,
    args.concurrency,
    async (file) => {
      args.ui.markRunning(file);
      const result = await runPbtFile({
        repoRoot: args.repoRoot,
        file,
        seed: args.seed,
        numRuns: args.numRuns,
        sampleInterruptMs: args.sampleInterruptMs,
      });
      args.ui.markDone(result);
      return result;
    }
  );
  const passed = results.filter((r) => r.code === 0).length;
  const ok = passed === results.length;
  args.ui.endAttempt(ok);
  if (!ok) {
    args.ui.printFailures(results);
  }
  return { ok, results, durationMs: Date.now() - started };
}

export const REPO_ROOT = join(import.meta.dirname, '../../..');
export const DEFAULT_NUM_RUNS = 200;
export const DEFAULT_SAMPLE_INTERRUPT_MS = 120_000;
