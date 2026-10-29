import type { readLatestRunSummary } from './verify-budget';
import { findBudgetOverruns, formatBudgetOverruns } from './verify-budget';
import { redactSecrets } from './verify-shard-stream';
import type { VerifyPlan } from './verify-shards';
import { validateShardResult } from './verify-shards';

export type Result = {
  taskId: string;
  hash: string;
  passed: boolean;
  cache: string;
  milliseconds: number;
  exitCode: number;
  interrupted?: boolean;
  /**
   * How long an interrupted task had run when the shard was stopped: a lower
   * bound on its cost, never a measured duration.
   */
  ranForMs?: number;
};

/** A task the shard was still running when it stopped, and for how long. */
export type RunningTask = { readonly taskId: string; readonly seconds: number };

/**
 * A missing verdict is a failure, never proof of execution or a measured
 * duration. A task still running when the shard stopped records how long it
 * had run, so the next plan does not pack it by the estimate it outran.
 */
export function completeResults(
  tasks: VerifyPlan['tasks'],
  results: readonly Result[],
  status: number,
  running: readonly RunningTask[] = []
): Result[] {
  const seen = new Set(results.map((result) => result.taskId));
  const ranFor = new Map(
    running.map((task) => [task.taskId, Math.round(task.seconds * 1000)])
  );
  return [
    ...results,
    ...tasks
      .filter((task) => !seen.has(task.taskId))
      .map((task) => {
        const ranForMs = ranFor.get(task.taskId);
        return {
          taskId: task.taskId,
          hash: task.hash,
          passed: false,
          cache: 'MISS',
          milliseconds: 0,
          exitCode: status || 1,
          interrupted: true,
          ...(ranForMs === undefined ? {} : { ranForMs }),
        };
      }),
  ];
}
function reportOverruns(
  summary: ReturnType<typeof readLatestRunSummary>
): string {
  if (!summary) return '';
  const overruns = findBudgetOverruns(summary, true);
  if (overruns.length === 0) return '';
  const text = formatBudgetOverruns(overruns);
  console.error(text);
  return text;
}

export function collectResults(args: {
  plan: VerifyPlan;
  shard: VerifyPlan['shards'][number];
  summary: ReturnType<typeof readLatestRunSummary>;
  needed: ReadonlySet<string>;
  status: number;
  env: NodeJS.ProcessEnv;
  /** Tasks still running when the shard stopped. */
  running?: readonly RunningTask[];
}): { results: Result[]; verdict: number; budgetOverruns: string } {
  const { plan, shard, summary, needed, status, env } = args;
  const results: Result[] = shard.tasks
    .filter(
      (task) =>
        task.hit && !summary?.tasks?.some((item) => item.taskId === task.taskId)
    )
    .map((task) => ({
      taskId: task.taskId,
      hash: task.hash,
      passed: true,
      cache: 'HIT',
      milliseconds: 0,
      exitCode: 0,
    }));
  for (const item of summary?.tasks ?? []) {
    const task = item as {
      taskId: string;
      hash: string;
      cache: { status: string };
      execution?: { exitCode: number; startTime: number; endTime: number };
    };
    const milliseconds = task.execution
      ? task.execution.endTime - task.execution.startTime
      : 0;
    const passed =
      task.cache.status === 'HIT' || task.execution?.exitCode === 0;
    // Transit nodes have no command, output or verdict.
    if (!shard.tasks.some((expected) => expected.taskId === task.taskId)) {
      const external = plan.tasks.find(
        (expected) => expected.taskId === task.taskId
      );
      if (
        external &&
        (!needed.has(task.taskId) ||
          external.hash !== task.hash ||
          task.cache.status !== 'HIT')
      )
        throw new Error(
          `Unexpected execution or changed prerequisite: ${task.taskId}`
        );
      continue;
    }
    console.log(
      `COMPLETE ${task.taskId}; exit: ${task.execution?.exitCode ?? (passed ? 0 : 1)}; elapsed: ${(milliseconds / 1000).toFixed(3)}s; cache: ${task.cache.status}`
    );
    results.push({
      taskId: task.taskId,
      hash: task.hash,
      passed,
      cache: task.cache.status,
      milliseconds,
      exitCode: task.execution?.exitCode ?? (passed ? 0 : 1),
    });
    if (!passed)
      console.error(
        redactSecrets(
          `FAILED ${task.taskId}; command: ${shard.tasks.find((t) => t.taskId === task.taskId)!.command}; exit code ${task.execution?.exitCode ?? 'missing'}; elapsed ${(milliseconds / 1000).toFixed(3)}s`,
          env
        )
      );
  }
  const complete = completeResults(shard.tasks, results, status, args.running);
  let verdict = status;
  try {
    validateShardResult(shard, complete);
  } catch (error) {
    // One line: the full explanation is the shard's diagnosis report.
    console.error(
      `Shard result check: ${error instanceof Error ? error.message : String(error)}`
    );
    verdict = status || 1;
  }
  const budgetOverruns = reportOverruns(summary);
  if (budgetOverruns) verdict = 1;
  return { results: complete, verdict, budgetOverruns };
}
