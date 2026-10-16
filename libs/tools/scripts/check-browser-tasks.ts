// @io-wall-ok — select pinned renderer setup from the immutable task plan.
import { appendFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CheckPlan } from './check-shards';

export function needsBrowser(tasks: CheckPlan['tasks']): boolean {
  return tasks.some(
    (task) =>
      !task.hit &&
      (task.taskId === '@apps/product#test:contract:render' ||
        task.taskId === '@apps/product#test:release-journeys' ||
        task.taskId === '@pkgs/ui-testing-bun-webview#test')
  );
}
if (import.meta.main) {
  const plan = JSON.parse(
    readFileSync(
      join(import.meta.dirname, '../../../.cache/check-ci/plan.json'),
      'utf8'
    )
  ) as CheckPlan;
  const shard = plan.shards[Number(process.env['CHECK_SHARD'])]!;
  appendFileSync(
    process.env['GITHUB_OUTPUT']!,
    `needed=${needsBrowser(shard.tasks)}\n`
  );
}
