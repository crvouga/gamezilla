import { describe, expect, test } from 'bun:test';
import { assertProperty, fc } from '@pkgs/property';
import { MAX_SHARDS, planShards, shardPlanOutputs } from './check-shards';
import type { PlannedTask } from './turbo-preflight';

const TYPES = [
  'tc',
  'lint',
  'test',
  'test:e2e',
  'build',
  'check:bundle-budget',
];

function miss(taskId: string, dependencies: string[] = []): PlannedTask {
  return { taskId, hash: taskId, hit: false, source: null, dependencies };
}

/** A random miss set: package × task-type ids, each depending on earlier ones. */
const missesArb = fc
  .uniqueArray(
    fc.tuple(fc.integer({ min: 0, max: 30 }), fc.constantFrom(...TYPES)),
    { maxLength: 120, selector: ([pkg, type]) => `@p/${String(pkg)}#${type}` }
  )
  .chain((pairs) => {
    const ids = pairs.map(([pkg, type]) => `@p/${String(pkg)}#${type}`);
    return fc
      .tuple(
        ...ids.map((_, index) =>
          fc.subarray(ids.slice(0, index), {
            maxLength: Math.min(3, index),
          })
        )
      )
      .map((deps) => ids.map((id, index) => miss(id, deps[index] ?? [])));
  });

const costsArb = fc.dictionary(fc.string(), fc.integer({ min: 1, max: 300 }));

describe('planShards', () => {
  test('every miss runs on exactly one shard, within the shard cap', () => {
    assertProperty(
      'misses are partitioned',
      fc.property(
        missesArb,
        costsArb,
        fc.integer({ min: 1, max: 20 }),
        (misses, costs, max) => {
          const plan = planShards({ toExecute: misses }, costs, max);
          const assigned = plan.shards.flat();
          expect([...assigned].sort()).toEqual(
            misses.map((m) => m.taskId).sort()
          );
          expect(plan.shards.length).toBeLessThanOrEqual(Math.max(max, 0));
          expect(plan.shards.every((ids) => ids.length > 0)).toBe(true);
          expect(plan.shards.length === 0).toBe(misses.length === 0);
        }
      )
    );
  });

  test('a miss shares a shard with the non-tc misses it depends on', () => {
    assertProperty(
      'dependency bundles stay together',
      fc.property(missesArb, (misses) => {
        const plan = planShards({ toExecute: misses }, {}, MAX_SHARDS);
        const shardOf = new Map(
          plan.shards.flatMap((ids, index) =>
            ids.map((id) => [id, index] as const)
          )
        );
        for (const task of misses) {
          for (const dep of task.dependencies) {
            if (dep.endsWith('#tc')) continue;
            expect(shardOf.get(dep)).toBe(shardOf.get(task.taskId));
          }
        }
      })
    );
  });

  test('the same plan always splits the same way', () => {
    assertProperty(
      'deterministic',
      fc.property(missesArb, costsArb, (misses, costs) => {
        const reversed = [...misses].reverse();
        expect(planShards({ toExecute: reversed }, costs)).toEqual(
          planShards({ toExecute: misses }, costs)
        );
      })
    );
  });

  test('heavy tasks spread across shards instead of stacking', () => {
    const misses = ['a', 'b', 'c', 'd'].map((p) => miss(`@p/${p}#test:e2e`));
    const costs = Object.fromEntries(misses.map((m) => [m.taskId, 100]));
    const plan = planShards({ toExecute: misses }, costs, 4);
    expect(plan.shards).toHaveLength(4);
    expect(plan.costs).toEqual([100, 100, 100, 100]);
  });

  test('outputs are the matrix indexes and the per-shard task ids', () => {
    expect(
      shardPlanOutputs({
        shards: [['@p/a#lint'], ['@p/b#test']],
        costs: [1, 1],
      })
    ).toBe('shards=[0,1]\nassignment=[["@p/a#lint"],["@p/b#test"]]\n');
  });
});
