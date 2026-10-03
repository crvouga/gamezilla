import { expect, test } from 'bun:test';
import { assertProperty, fc } from '@pkgs/property';
import { redactSecrets, taskStream } from './check-shard-stream';
import {
  balanceShards,
  type CheckTask,
  validatePlan,
  validateShardResult,
} from './check-shards';

function task(id: string, seconds = 1, dependencies: string[] = []): CheckTask {
  return {
    taskId: id,
    hash: '0123456789abcdef',
    hit: false,
    source: null,
    command: 'bun test',
    directory: 'pkgs/example',
    seconds,
    dependencies,
  };
}

test('LPT preserves every input exactly once and is independent of discovery order', () => {
  assertProperty(
    'check-balanced-partition',
    fc.property(
      fc.array(fc.integer({ min: 1, max: 1000 }), {
        minLength: 1,
        maxLength: 600,
      }),
      fc.integer({ min: 1, max: 64 }),
      (durations, count) => {
        const tasks = durations.map((seconds, index) =>
          task(`package-${index}#test`, seconds)
        );
        const first = balanceShards(tasks, count);
        const second = balanceShards([...tasks].reverse(), count);
        expect(first.shards).toEqual(second.shards);
        expect(
          first.shards
            .flatMap((shard) => shard.tasks.map((task) => task.taskId))
            .sort()
        ).toEqual(tasks.map((task) => task.taskId).sort());
        expect(() => validatePlan(first)).not.toThrow();
      }
    )
  );
});

test('producer chains share one shard without duplicating independent checks', () => {
  const plan = balanceShards(
    [task('build', 10), task('offline', 1, ['build']), task('other', 11)],
    2
  );
  expect(plan.shards[0]!.seconds).toBe(11);
  expect(plan.shards[1]!.seconds).toBe(11);
  expect(
    plan.shards.find((shard) =>
      shard.tasks.some((task) => task.taskId === 'build')
    )!.tasks
  ).toHaveLength(2);
});

test('verdict rejects omissions, duplicates, changed hashes, failed and cancelled tasks', () => {
  const plan = balanceShards([task('one'), task('two')], 1);
  const shard = plan.shards[0]!;
  const passed = shard.tasks.map((task) => ({ ...task, passed: true }));
  expect(() => validateShardResult(shard, passed)).not.toThrow();
  for (const result of [
    passed.slice(1),
    [...passed, passed[0]!],
    [{ ...passed[0]!, hash: 'wrong' }, passed[1]!],
    [{ ...passed[0]!, passed: false }, passed[1]!],
  ])
    expect(() => validateShardResult(shard, result)).toThrow();
});

// regression: check-opaque-task-failure
test('literal Turbo failure immediately identifies the task, command, elapsed time and stderr', () => {
  const logs: string[] = [];
  const stream = taskStream([task('@libs/example#test')], (line) =>
    logs.push(line)
  );
  stream(
    JSON.stringify({
      source: '@libs/example#test',
      text: 'assertion failed: expected 1, received 2',
      level: 'info',
    })
  );
  stream(
    JSON.stringify({
      source: '@libs/example#test',
      text: 'command finished with error, but continuing...',
      level: 'error',
    })
  );
  expect(logs.join('\n')).toContain(
    'FAILED @libs/example#test; command: bun test; elapsed:'
  );
  expect(logs.join('\n')).toContain('assertion failed: expected 1, received 2');
  expect(redactSecrets('secret-value', { TURBO_TOKEN: 'secret-value' })).toBe(
    '[REDACTED]'
  );
});
