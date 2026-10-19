import { expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/property-shared/assert-property';
import fc from 'fast-check';
import {
  balanceShards,
  planWarnings,
  type VerifyTask,
  validatePlan,
} from './verify-shards';

function task(
  taskId: string,
  seconds: number,
  dependencies: string[] = []
): VerifyTask {
  return {
    taskId,
    seconds,
    dependencies,
    hash: '0123456789abcdef',
    hit: false,
    source: null,
    command: 'bun test',
    directory: 'pkgs/example',
    durationSource: 'history',
  };
}

// regression: verify-indivisible-shard-balance-warning
test('a literal 333-second dedicated task beside 104-second packed shards is not a packing defect', () => {
  const plan = balanceShards(
    [
      task('@apps/product#test', 333),
      ...Array.from({ length: 8 }, (_, index) => task(`pkg-${index}#test`, 52)),
      { ...task('cached#test', 1000), hit: true },
    ],
    5,
    60
  );
  expect(plan.shards.slice(0, 5).map((shard) => shard.seconds)).toEqual([
    333, 104, 104, 104, 104,
  ]);
  expect(planWarnings(plan)).toEqual([]);
});

test('indivisible dependency chains and cache hits never distort an even pack', () => {
  assertProperty(
    'dedicated dependency group balance warnings',
    fc.property(
      fc.integer({ min: 61, max: 1000 }),
      fc.integer({ min: 1, max: 10 }),
      (seconds, count) => {
        const plan = balanceShards(
          [
            task('producer', seconds),
            task('consumer', seconds, ['producer']),
            { ...task('cached#test', seconds), hit: true },
            ...Array.from({ length: count * 2 }, (_, index) =>
              task(`pkg-${index}#test`, 30)
            ),
          ],
          count + 1,
          60
        );
        expect(planWarnings(plan)).toEqual([]);
      }
    )
  );
});

test('a dedicated heavy task never hides a pack beside an underfilled single-task runner', () => {
  const tasks = [
    task('dedicated', 333),
    ...Array.from({ length: 4 }, (_, index) => task(`small-${index}`, 52)),
    task('underfilled', 104),
  ];
  const balanced = balanceShards(tasks, 3, 60);
  expect(planWarnings(balanced)).toEqual([]);
  const plan = {
    ...balanced,
    shards: balanced.shards.map((shard, index) =>
      index === 1
        ? { ...shard, tasks: tasks.slice(1, 5), seconds: 208 }
        : index === 2
          ? { ...shard, tasks: tasks.slice(5), seconds: 104 }
          : shard
    ),
  };
  validatePlan(plan);
  expect(planWarnings(plan).join(' ')).toContain('max/min exceeds 1.25');
  expect(planWarnings(plan).join(' ')).toContain('more than 20%');
});
