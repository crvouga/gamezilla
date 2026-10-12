// @io-wall-ok — the CI entry reads the exact plan produced before Turbo executes.
import { readFileSync } from 'node:fs';
import { closeCommit } from '@crvouga/atlas/reports/publish';
import type { SourceIdentity } from '@crvouga/atlas/reports/source-content';
import { reportGeneration } from '@crvouga/atlas/reports/source-content';
import { reportTask } from '@libs/harness/report-ready';
import type { ObjectStore } from '@pkgs/object-store-root-shared/interface';
import { reuseReportTask, verifyPublications } from './report-task-publish';

export type ReportPlan = {
  readonly generation: number;
  readonly tasks: readonly {
    readonly taskId: string;
    readonly hash: string;
    readonly hit: boolean;
  }[];
};

export function readReportPlan(path: string): ReportPlan {
  const plan = JSON.parse(readFileSync(path, 'utf8')) as ReportPlan;
  if (
    !Array.isArray(plan.tasks) ||
    !Number.isSafeInteger(plan.generation) ||
    plan.generation < 0
  )
    throw new Error('Invalid Check report plan');
  const seen = new Set<string>();
  for (const task of plan.tasks) {
    if (
      typeof task.taskId !== 'string' ||
      typeof task.hash !== 'string' ||
      !/^[0-9a-f]{16,64}$/.test(task.hash) ||
      typeof task.hit !== 'boolean' ||
      seen.has(task.taskId)
    )
      throw new Error('Invalid Check task identity');
    seen.add(task.taskId);
  }
  return plan;
}

/** Incomplete evidence closes red, including suites blocked by a failed prerequisite. */
export async function finishReport(args: {
  readonly store: ObjectStore;
  readonly sha: string;
  readonly runId: string;
  readonly plan: ReportPlan;
  readonly endedAtMs: number;
  readonly failed: boolean;
}) {
  let incomplete: unknown;
  try {
    await verifyPublications({ ...args, tasks: args.plan.tasks });
  } catch (error) {
    incomplete = error;
  }
  const commit = await closeCommit(args.store, {
    sha: args.sha,
    publicationId: args.runId,
    endedAtMs: args.endedAtMs,
    status: args.failed || incomplete !== undefined ? 'failed' : 'passed',
  });
  if (incomplete !== undefined) throw incomplete;
  if (!args.failed && commit.status !== 'passed')
    throw new Error('Report source verdict failed');
  return commit;
}

export function taskIdentity(plan: ReportPlan, taskId: string): SourceIdentity {
  const task = plan.tasks.find((task) => task.taskId === taskId);
  if (task === undefined)
    throw new Error(`Task absent from Check report plan: ${taskId}`);
  return { taskHash: task.hash, generation: plan.generation };
}

export function createReportPlan(
  tasks: ReportPlan['tasks'],
  nowMs: number,
  retentionDays: number
): ReportPlan {
  return { generation: reportGeneration(nowMs, retentionDays), tasks };
}

export async function reusePlannedReports(args: {
  readonly store: ObjectStore;
  readonly sha: string;
  readonly runId: string;
  readonly plan: ReportPlan;
}): Promise<readonly string[]> {
  const reports = args.plan.tasks.filter(
    (task) => reportTask(task.taskId) !== null
  );
  const missing: string[] = [];
  let next = 0;
  const worker = async () => {
    for (let index = next++; index < reports.length; index = next++) {
      const task = reports[index]!;
      const reused =
        task.hit &&
        (await reuseReportTask({
          ...args,
          taskId: task.taskId,
          identity: taskIdentity(args.plan, task.taskId),
        }));
      if (!reused) missing.push(task.taskId);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(16, reports.length) }, worker)
  );
  return missing.sort();
}
