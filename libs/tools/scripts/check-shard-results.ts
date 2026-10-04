import type { readLatestRunSummary } from './check-budget';
import { findBudgetOverruns, formatBudgetOverruns } from './check-budget';
import { redactSecrets } from './check-shard-stream';
import type { CheckPlan } from './check-shards';
import { validateShardResult } from './check-shards';

export type Result = {
  taskId: string;
  hash: string;
  passed: boolean;
  cache: string;
  milliseconds: number;
  exitCode: number;
  interrupted?: boolean;
};

/** A missing verdict is a failure, never proof of execution or a measured duration. */
export function completeResults(
  tasks: CheckPlan['tasks'],
  results: readonly Result[],
  status: number
): Result[] {
  const seen = new Set(results.map((result) => result.taskId));
  return [
    ...results,
    ...tasks
      .filter((task) => !seen.has(task.taskId))
      .map((task) => ({
        taskId: task.taskId,
        hash: task.hash,
        passed: false,
        cache: 'MISS',
        milliseconds: 0,
        exitCode: status || 1,
        interrupted: true,
      })),
  ];
}
export function collectResults(args: {
  plan: CheckPlan;
  shard: CheckPlan['shards'][number];
  summary: ReturnType<typeof readLatestRunSummary>;
  needed: ReadonlySet<string>;
  status: number;
  env: NodeJS.ProcessEnv;
}): { results: Result[]; verdict: number } {
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
  const complete = completeResults(shard.tasks, results, status);
  let verdict = status;
  try {
    validateShardResult(shard, complete);
  } catch (error) {
    console.error(error);
    verdict = status || 1;
  }
  if (summary) {
    const overruns = findBudgetOverruns(summary, true);
    if (overruns.length) {
      console.error(formatBudgetOverruns(overruns));
      verdict = 1;
    }
  }
  return { results: complete, verdict };
}
