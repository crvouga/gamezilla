import { describe, expect, test } from 'bun:test';
import { assertProperty, fc } from '@pkgs/property';
import { planCheckShards } from './check-report-plan';
import type { PlannedTask } from './turbo-preflight';

function task(taskId: string, hit: boolean): PlannedTask {
  return {
    taskId,
    hit,
    hash: taskId,
    source: hit ? 'REMOTE' : null,
    dependencies: [],
  };
}

describe('Check report ownership', () => {
  test('every miss and every report has exactly one owner, including all-hit runs', () => {
    assertProperty(
      'reports are never lost to caching',
      fc.property(
        fc.array(fc.tuple(fc.boolean(), fc.boolean()), { maxLength: 80 }),
        (inputs) => {
          const tasks = inputs.map(([spec, hit], index) =>
            task(`@libs/package-${index}#${spec ? 'test:spec:0' : 'lint'}`, hit)
          );
          const plan = planCheckShards(
            { tasks, toExecute: tasks.filter((t) => !t.hit), remoteHits: [] },
            {}
          );
          expect(plan.shards.flat().sort()).toEqual(
            tasks
              .filter((t, i) => !t.hit || inputs[i]?.[0])
              .map((t) => t.taskId)
              .sort()
          );
          expect(plan.shards.length).toBeLessThanOrEqual(12);
        }
      )
    );
  });

  test('measured upload time contributes even when the check is cached', () => {
    const tasks = [task('@libs/a#test:spec:0', true)];
    expect(
      planCheckShards(
        { tasks, toExecute: [], remoteHits: [] },
        {
          '@libs/a#publish:spec:0': 125,
        }
      ).costs
    ).toEqual([125]);
  });
});
