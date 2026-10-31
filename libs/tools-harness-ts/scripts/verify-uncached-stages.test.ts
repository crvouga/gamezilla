import { expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';
import { balanceShards, type VerifyTask } from './verify-shards';
import { publishedTasks, requiredTasks } from './verify-stage-cache';

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
    durationSource: 'history',
  };
}

// regression: uncached-prerequisite-evidence-missing
test('Storybook coverage and both consumers run together without publishing an absent cache archive', () => {
  const owner = '@pkgs/ui-root-harness-ts';
  const build = task(`${owner}#storybook:build`);
  const coverage = task(`${owner}#storybook:coverage`, [build.taskId], false);
  const unit = task(`${owner}#test`, [coverage.taskId]);
  const storybook = task(`${owner}#ci:storybook`, [
    build.taskId,
    coverage.taskId,
  ]);
  const plan = balanceShards([build, coverage, unit, storybook], 4);
  const shard = plan.shards.find((s) => s.tasks.includes(coverage))!;
  expect(shard.stage).toBe('verifications');
  expect(shard.tasks.map((t) => t.taskId).sort()).toEqual(
    [coverage.taskId, unit.taskId, storybook.taskId].sort()
  );
  expect(
    plan.shards.flatMap((s) => publishedTasks(plan, s)).map((t) => t.taskId)
  ).toEqual([build.taskId]);
});

test('uncached dependency closures never cross shard boundaries', () => {
  assertProperty(
    'uncached tasks execute with every transitive consumer',
    fc.property(
      fc.array(
        fc.record({
          cacheable: fc.boolean(),
          build: fc.boolean(),
          dependencies: fc.array(fc.nat({ max: 19 }), { maxLength: 5 }),
        }),
        { minLength: 1, maxLength: 20 }
      ),
      (nodes) => {
        const ids = nodes.map(
          (node, i) => `package-${i}#${node.build ? 'build' : 'test'}`
        );
        const tasks = nodes.map((node, i) =>
          task(
            ids[i]!,
            [
              ...new Set(
                node.dependencies.filter((d) => d < i).map((d) => ids[d]!)
              ),
            ],
            node.cacheable
          )
        );
        const plan = balanceShards(tasks, 4);
        const owners = new Map(
          plan.shards.flatMap((s) =>
            s.tasks.map((t) => [t.taskId, s.index] as const)
          )
        );
        for (const root of tasks)
          for (const dependency of requiredTasks(plan, [root]))
            if (dependency.cacheable === false)
              expect(owners.get(root.taskId)).toBe(
                owners.get(dependency.taskId)
              );
      }
    )
  );
});

// regression: uncached-prerequisite-evidence-missing
test('an uncached build stays with its consumer even beside an independent task', () => {
  const independent = task('package-0#test', [], false);
  const build = task('package-1#build', [], false);
  const consumer = task('package-2#test', [build.taskId], false);
  const plan = balanceShards([independent, build, consumer], 4);
  const shard = plan.shards.find((s) => s.tasks.includes(build))!;
  expect(shard.stage).toBe('verifications');
  expect(shard.tasks).toContain(consumer);
  expect(plan.shards.flatMap((s) => publishedTasks(plan, s))).toEqual([]);
});
