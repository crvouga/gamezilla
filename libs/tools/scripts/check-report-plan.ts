import { reportTask } from '@libs/harness/ci/report-ready';
import {
  expectedCost,
  planShards,
  type ShardPlan,
  type TaskCosts,
} from './check-shards';
import type { RunPlan } from './turbo-preflight';

/** Cache hits still own report uploads; upload cost also contributes to balance. */
export function planCheckShards(plan: RunPlan, costs: TaskCosts): ShardPlan {
  const work = plan.tasks.filter(
    (task) => !task.hit || reportTask(task.taskId) !== null
  );
  const weighted = Object.fromEntries(
    work.map((task) => {
      const upload =
        reportTask(task.taskId) === null
          ? 0
          : (costs[task.taskId.replace('#test:spec:', '#publish:spec:')] ?? 30);
      return [
        task.taskId,
        (task.hit ? 0 : expectedCost(task.taskId, costs)) + upload,
      ];
    })
  );
  return planShards({ toExecute: work }, weighted);
}
