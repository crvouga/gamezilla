import { expect, test } from 'bun:test';
import { tasksAfterSettled } from './verify-shard-process';
import type { VerifyTask } from './verify-shards';

function task(id: string, dependencies: string[] = []): VerifyTask {
  return {
    taskId: id,
    seconds: 10,
    dependencies,
    hash: '0123456789abcdef',
    hit: false,
    source: null,
    command: 'bun test',
    directory: 'pkgs/example',
    durationSource: 'history',
  };
}

// regression: verify-shard-budget-kill-skips-cache
test('after a task outruns its budget, every task that can still pass is run so it reaches the cache', () => {
  // The Release shard that lost its queue behind a 600 s journey (Verify run
  // 40723916963): the journey was killed, the tasks after it never ran.
  const tasks = [
    task('journeys#test'),
    task('a#lint'),
    task('b#tc'),
    task('c#test'),
  ];
  expect(
    tasksAfterSettled(
      tasks.map((item) => item.taskId),
      tasks,
      ['journeys#test']
    )
  ).toEqual(['a#lint', 'b#tc', 'c#test']);
});

test('a task that needs a killed task, directly or through another, would run it again and is left out', () => {
  const tasks = [
    task('slow#build'),
    task('mid#tc', ['slow#build']),
    task('top#test', ['mid#tc']),
    task('free#lint'),
  ];
  expect(
    tasksAfterSettled(
      tasks.map((item) => item.taskId),
      tasks,
      ['slow#build']
    )
  ).toEqual(['free#lint']);
});

test('a failed task and its dependents are left out; a dependency on something finished is not', () => {
  const tasks = [
    task('done#build'),
    task('broken#test', ['done#build']),
    task('after#report', ['broken#test']),
    task('uses#test', ['done#build']),
  ];
  expect(
    tasksAfterSettled(
      tasks.map((item) => item.taskId),
      tasks,
      ['broken#test']
    )
  ).toEqual(['done#build', 'uses#test']);
});

test('nothing settled leaves every task, and a dependency cycle terminates', () => {
  const tasks = [task('x#a', ['y#a']), task('y#a', ['x#a'])];
  const ids = tasks.map((item) => item.taskId);
  expect(tasksAfterSettled(ids, tasks, [])).toEqual(ids);
  expect(tasksAfterSettled(ids, tasks, ['x#a'])).toEqual([]);
});
