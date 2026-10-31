import { expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';
import { balanceShards, type VerifyTask } from './verify-shards';
import { publishedTasks } from './verify-stage-cache';

function task(
  taskId: string,
  dependencies: string[] = [],
  cacheable = true
): VerifyTask {
  return {
    taskId,
    dependencies,
    cacheable,
    hash: taskId,
    hit: false,
    source: null,
    command: 'bun test',
    directory: 'pkgs/ui-root-harness-ts',
    seconds: 1,
    durationSource: 'fallback',
  };
}

test('uncacheable Storybook coverage stays with its checks instead of publishing a nonexistent archive', () => {
  // regression: uncacheable-storybook-prerequisite-transfer
  const build = task('@pkgs/ui-root-harness-ts#storybook:build');
  const coverage = task(
    '@pkgs/ui-root-harness-ts#storybook:coverage',
    [build.taskId],
    false
  );
  const checks = [
    task('@pkgs/ui-root-harness-ts#test', [coverage.taskId]),
    task('@pkgs/ui-root-harness-ts#ci:storybook', [
      build.taskId,
      coverage.taskId,
    ]),
  ];
  const plan = balanceShards([build, coverage, ...checks], 4);
  const owner = plan.shards.find((shard) => shard.tasks.includes(coverage))!;
  expect(owner.stage).toBe('verifications');
  expect(owner.tasks).toEqual(expect.arrayContaining([coverage, ...checks]));
  for (const shard of plan.shards)
    expect(
      publishedTasks(plan, shard).every((entry) => entry.cacheable !== false)
    ).toBe(true);
  expect(plan.tasks).toHaveLength(4);
});

test('every uncacheable dependency executes with its consumers in any discovery order', () => {
  assertProperty(
    'uncacheable verification ownership',
    fc.property(
      fc.integer({ min: 1, max: 6 }),
      fc.integer({ min: 1, max: 6 }),
      fc.boolean(),
      (depth, width, fanIn) => {
        const build = task('portable#build');
        const chain: VerifyTask[] = [];
        for (let index = 0; index < depth; index++)
          chain.push(
            task(
              `live-${index}`,
              [chain.at(-1)?.taskId ?? build.taskId],
              index > 0 && index % 2 === 1
            )
          );
        const leaf = chain.at(-1)!;
        const independent = task('other-check');
        const checks = Array.from({ length: width }, (_, index) =>
          task(`check-${index}`, [
            leaf.taskId,
            ...(fanIn ? [independent.taskId] : []),
          ])
        );
        const tasks = [build, ...chain, independent, ...checks];
        for (const ordered of [tasks, [...tasks].reverse()]) {
          const plan = balanceShards(ordered, 4);
          const owners = new Map(
            plan.shards.flatMap((shard) =>
              shard.tasks.map((entry) => [entry.taskId, shard.index])
            )
          );
          for (const entry of tasks)
            for (const dependency of entry.dependencies)
              if (chain.some((candidate) => candidate.taskId === dependency))
                expect(owners.get(entry.taskId)).toBe(owners.get(dependency));
          expect(plan.shards.flatMap((shard) => shard.tasks)).toHaveLength(
            tasks.length
          );
        }
      }
    )
  );
});
