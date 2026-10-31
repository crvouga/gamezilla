// @io-wall-ok — select pinned renderer setup from the immutable task plan.
import { appendFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { VerifyPlan } from './verify-shards';

const BROWSER_TASKS = new Set([
  '@apps/product-ts#test:contract:render',
  '@pkgs/ui-testing-bun-webview-server-ts#test',
  '@pkgs/ui-root-harness-ts#ci:storybook',
  '@pkgs/ui-root-harness-ts#storybook:test',
  '@pkgs/ui-root-harness-ts#storybook:mcp:test',
]);

export function needsBrowser(tasks: VerifyPlan['tasks']): boolean {
  return tasks.some(
    (task) =>
      !task.hit &&
      (BROWSER_TASKS.has(task.taskId) ||
        task.taskId.startsWith('@apps/product-ts#test:release-journeys:'))
  );
}
if (import.meta.main) {
  const plan = JSON.parse(
    readFileSync(
      join(import.meta.dirname, '../../../.cache/verify-ci/plan.json'),
      'utf8'
    )
  ) as VerifyPlan;
  const shard = plan.shards[Number(process.env['VERIFY_SHARD'])]!;
  appendFileSync(
    process.env['GITHUB_OUTPUT']!,
    `needed=${needsBrowser(shard.tasks)}\n`
  );
}
