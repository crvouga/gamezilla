// @io-wall-ok — one process, one store, bounded publication pool.
import { readFileSync } from 'node:fs';
import type { ObjectStore } from '@pkgs/object-store/interface';
import { readReportPlan, taskIdentity } from './report-plan';
import { publishReportTask } from './report-task-publish';

export async function publishBatch(args: {
  readonly store: ObjectStore;
  readonly repoRoot: string;
  readonly sha: string;
  readonly runId: string;
  readonly planPath: string;
}): Promise<void> {
  const plan = readReportPlan(args.planPath);
  const ids = [
    ...new Set(
      JSON.parse(
        readFileSync(`${args.planPath}.missing.json`, 'utf8')
      ) as string[]
    ),
  ];
  let next = 0;
  const failures: unknown[] = [];
  async function worker(): Promise<void> {
    for (let index = next++; index < ids.length; index = next++) {
      const taskId = ids[index]!;
      try {
        await publishReportTask({
          ...args,
          taskId,
          identity: taskIdentity(plan, taskId),
        });
      } catch (error) {
        failures.push(error);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(8, ids.length) }, worker));
  if (failures.length)
    throw new AggregateError(failures, 'Report batch publication failed');
  console.log(
    `[report-publish] batch completed: ${ids.length} distinct sources`
  );
}
