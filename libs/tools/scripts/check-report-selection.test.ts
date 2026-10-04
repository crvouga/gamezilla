import { expect, test } from 'bun:test';
import type { PlannedTask } from './turbo-preflight';
import { restoreSelectedReports } from './turbo-preflight';

function task(
  taskId: string,
  hit: boolean,
  dependencies: string[] = []
): PlannedTask {
  return {
    taskId,
    hash: taskId,
    hit,
    source: hit ? 'REMOTE' : null,
    dependencies,
  };
}

test('published cached reports cause no restore; unpublished hits restore only their dependency closure', () => {
  const tasks = [
    task('tc', true),
    task('spec', true, ['tc']),
    task('unrelated', true),
    task('lint', false),
  ];
  const plan = { tasks, toExecute: [tasks[3]!], remoteHits: [] };
  expect(
    restoreSelectedReports(plan, []).toExecute.map((task) => task.taskId)
  ).toEqual(['lint']);
  const selected = restoreSelectedReports(plan, ['spec']);
  expect(selected.toExecute.map((task) => task.taskId)).toEqual([
    'spec',
    'lint',
  ]);
  expect(selected.remoteHits.map((task) => task.taskId)).toEqual([
    'spec',
    'tc',
  ]);
  expect(selected.tasks).toBe(tasks);
});
