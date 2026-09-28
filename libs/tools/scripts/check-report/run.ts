// @io-wall-ok — writes the report of a `turbo-ci-run` run.
/**
 * What `turbo-ci-run` calls once a run is over: collect the run's fragment,
 * write it where CI asked (`--report-fragment=<path>`), and — for a local
 * `bun check` — render it into the report store. A report is never the
 * verdict: a failure here warns and leaves the run's exit status alone.
 */
import { relative } from 'node:path';
import type { PlanTask } from './model';
import { readNewRunSummary } from './summaries';

export type ReportRunOptions = {
  readonly repoRoot: string;
  readonly plan: readonly PlanTask[] | null;
  /** Summaries on disk before turbo started; null when turbo did not run. */
  readonly summariesBefore: ReadonlySet<string> | null;
  readonly exitCode: number | null;
  /** Where to write the run's fragment (CI plan and shards). */
  readonly fragmentPath: string | null;
  /** Render the report into `.cache/check-report/` (a local `bun check`). */
  readonly render: boolean;
  readonly frames: boolean;
};

export async function reportRun(options: ReportRunOptions): Promise<void> {
  if (options.fragmentPath === null && !options.render) return;
  try {
    // Loaded on demand: most `turbo-ci-run` runs (lint, health) report nothing.
    const { collectFragment } = await import('./collect');
    const { mergeFragments } = await import('./model');
    const { storeReport, writeFragment } = await import('./store');
    const summary =
      options.summariesBefore === null
        ? null
        : readNewRunSummary(options.repoRoot, options.summariesBefore);
    const fragment = await collectFragment({
      repoRoot: options.repoRoot,
      plan: options.plan,
      summary,
      exitCode: options.exitCode,
    });
    if (options.fragmentPath !== null) {
      writeFragment(options.fragmentPath, fragment);
    }
    if (!options.render) return;
    const report = mergeFragments([fragment]);
    const path = storeReport({
      repoRoot: options.repoRoot,
      report,
      frames: options.frames,
    });
    console.log(
      `check-report: ${report.verdict} · ${report.id} → ${relative(options.repoRoot, path)} (open it: bun check:report)`
    );
  } catch (error) {
    console.warn(`check-report: no report for this run (${String(error)})`);
  }
}
