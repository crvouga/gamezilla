import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { balanceShards, type VerifyTask } from './verify-shards';
import { publishedTasks, requiredTasks } from './verify-stage-cache';

// regression: uncached-storybook-coverage-prerequisite
test('uncached Storybook coverage stays with its gate while units restore the build', () => {
  const config = JSON.parse(
    readFileSync(
      new URL('../../../pkgs/ui-root-harness-ts/turbo.json', import.meta.url),
      'utf8'
    )
  ) as { tasks: Record<string, { dependsOn?: string[] }> };
  const owner = '@pkgs/ui-root-harness-ts';
  const names = [
    'storybook:build',
    'storybook:coverage',
    'test',
    'ci:storybook',
  ];
  const tasks: VerifyTask[] = names.map((name) => ({
    taskId: `${owner}#${name}`,
    hash: name,
    hit: false,
    source: null,
    command: 'bun test',
    directory: 'pkgs/ui-root-harness-ts',
    seconds: 1,
    durationSource: 'fallback',
    dependencies: (config.tasks[name]?.dependsOn ?? [])
      .filter((dependency) => names.includes(dependency))
      .map((dependency) => `${owner}#${dependency}`),
  }));
  const plan = balanceShards(tasks, 64, 90);
  const coverage = `${owner}#storybook:coverage`;
  const shard = plan.shards.find((item) =>
    item.tasks.some((task) => task.taskId === coverage)
  )!;
  expect(shard.stage).toBe('verifications');
  expect(shard.tasks.map((task) => task.taskId)).toContain(
    `${owner}#ci:storybook`
  );
  expect(
    requiredTasks(plan, [
      tasks.find((task) => task.taskId === `${owner}#ci:storybook`)!,
    ]).map((task) => task.taskId)
  ).toContain(coverage);
  expect(publishedTasks(plan, shard).map((task) => task.taskId)).not.toContain(
    coverage
  );
  expect(
    requiredTasks(plan, [
      tasks.find((task) => task.taskId === `${owner}#test`)!,
    ]).map((task) => task.taskId)
  ).toEqual([`${owner}#storybook:build`]);
  expect(plan.shards.flatMap((item) => item.tasks)).toHaveLength(names.length);
});
