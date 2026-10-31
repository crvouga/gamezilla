import { expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';
import { balanceShards, type VerifyTask } from './verify-shards';
import { publishedTasks, stageCachePaths } from './verify-stage-cache';

function task(taskId: string, dependencies: string[] = []): VerifyTask {
  return {
    taskId,
    dependencies,
    hash: taskId.replaceAll(/\W/g, ''),
    hit: false,
    source: null,
    cacheable: true,
    command: 'bun test',
    directory: 'pkgs/ui-root-harness-ts',
    seconds: 1,
    durationSource: 'fallback',
  };
}

function storybookTasks(extraConsumers = 0): VerifyTask[] {
  const build = task('@pkgs/ui-root-harness-ts#storybook:build');
  const coverage = {
    ...task('@pkgs/ui-root-harness-ts#storybook:coverage', [build.taskId]),
    cacheable: false,
  };
  return [
    build,
    coverage,
    task('@pkgs/ui-root-harness-ts#test', [coverage.taskId]),
    task('@pkgs/ui-root-harness-ts#ci:storybook', [
      build.taskId,
      coverage.taskId,
    ]),
    ...Array.from({ length: extraConsumers }, (_, index) =>
      task(`@pkgs/ui-root-harness-ts#check:${index}`, [coverage.taskId])
    ),
  ];
}

function assertSharedCheckerStaysWithConsumers(tasks: VerifyTask[]) {
  const plan = balanceShards(tasks, 4, 720);
  const coverage = tasks.find((task) => task.cacheable === false)!;
  const owner = plan.shards.find((shard) =>
    shard.tasks.some((task) => task.taskId === coverage.taskId)
  )!;
  expect(owner.stage).toBe('verifications');
  for (const consumer of tasks.filter((task) =>
    task.dependencies.includes(coverage.taskId)
  ))
    expect(owner.tasks.map((task) => task.taskId)).toContain(consumer.taskId);
  expect(plan.shards.flatMap((shard) => shard.tasks)).toHaveLength(
    tasks.length
  );
  expect(
    plan.shards.flatMap((shard) => publishedTasks(plan, shard))
  ).not.toContainEqual(coverage);
  // No fictitious cache archive is needed to transfer this owner's verdict.
  expect(stageCachePaths(plan, owner, '.', false)).toEqual([]);
}

// regression: uncached-checker-requires-nonexistent-artifact
test('shared uncached Storybook coverage never requires a prerequisite cache archive', () => {
  assertSharedCheckerStaysWithConsumers(storybookTasks());
});

test('uncached shared checkers stay with all consumers regardless of discovery order', () => {
  assertProperty(
    'uncached shared checker ownership',
    fc.property(
      fc.integer({ min: 0, max: 8 }),
      fc.boolean(),
      (extra, reverse) => {
        const tasks = storybookTasks(extra);
        assertSharedCheckerStaysWithConsumers(
          reverse ? tasks.reverse() : tasks
        );
      }
    )
  );
});
