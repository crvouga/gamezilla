// @io-wall-ok — select pinned renderer setup from the immutable task plan.
import { appendFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { VerifyPlan } from './verify-shards';

const BROWSER_TASKS = new Set([
  '@pkgs/ui-testing-bun-webview-server-ts#test',
  '@pkgs/ui-root-harness-ts#storybook:test',
  '@pkgs/ui-root-harness-ts#storybook:partition',
  '@pkgs/ui-root-harness-ts#storybook:mcp:test',
]);

export function browserTask(taskId: string): boolean {
  return (
    BROWSER_TASKS.has(taskId) ||
    taskId.startsWith('@apps/product-ts#test:release-journeys:') ||
    taskId.startsWith('@pkgs/ui-root-harness-ts#ci:storybook:')
  );
}

export function solverTask(taskId: string): boolean {
  return (
    taskId === '@pkgs/auth-root-harness-ts#test' ||
    taskId === '@pkgs/quint-server-ts#test' ||
    taskId.includes('#verify:models')
  );
}

export function needsBrowser(tasks: VerifyPlan['tasks']): boolean {
  return tasks.some((task) => !task.hit && browserTask(task.taskId));
}
export function needsSolver(tasks: VerifyPlan['tasks']): boolean {
  return tasks.some((task) => !task.hit && solverTask(task.taskId));
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
    `needed=${needsBrowser(shard.tasks)}\nsolver=${needsSolver(shard.tasks)}\n`
  );
}
