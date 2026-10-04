import { expect, test } from 'bun:test';
import { assertProperty, fc } from '@pkgs/property';
import { needsBrowser } from './check-browser-tasks';
import { redactSecrets, taskStream } from './check-shard-stream';
import {
  balanceShards,
  type CheckTask,
  planWarnings,
  validatePlan,
  validateShardResult,
} from './check-shards';
import { publishedTasks, requiredTasks } from './check-stage-cache';
import { estimateTask } from './check-task-estimates';

function task(id: string, seconds = 1, dependencies: string[] = []): CheckTask {
  return {
    taskId: id,
    hash: '0123456789abcdef',
    hit: false,
    source: null,
    command: 'bun test',
    directory: 'pkgs/example',
    seconds,
    durationSource: 'history',
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
  const stream = taskStream(
    [task('@libs/example#test')],
    (line) => logs.push(line),
    { now: () => 1000, completed: () => false }
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

// regression: check-ui-fanin-shard-collapse
test('shared builds and literal UI fan-in do not bind parallel tests to one owner', () => {
  const tasks = [
    task('ui-quality-check#build', 8),
    task('@apps/product#tc', 2),
    task('@apps/product#test:spec:0', 100),
    task('@libs/billing#test:spec:0', 100),
    task('@apps/product#prepare:ui-quality', 5, [
      '@apps/product#test:spec:0',
      '@libs/billing#test:spec:0',
    ]),
    task('@apps/product#check:ui-quality', 60, [
      '@apps/product#prepare:ui-quality',
      '@apps/product#tc',
      'ui-quality-check#build',
    ]),
  ];
  const plan = balanceShards(tasks, 2);
  expect(plan.shards.slice(0, 2).map((s) => s.seconds)).toEqual([102, 100]);
  expect(plan.shards[2]!.tasks.map((t) => t.taskId)).toEqual([
    'ui-quality-check#build',
  ]);
  expect(plan.shards[3]!.tasks).toHaveLength(2);
  expect(
    requiredTasks(plan, plan.shards[3]!.tasks)
      .map((t) => t.taskId)
      .sort()
  ).toEqual(
    tasks
      .slice(0, 5)
      .map((t) => t.taskId)
      .sort()
  );
  expect(publishedTasks(plan, plan.shards[2]!).map((t) => t.taskId)).toEqual([
    'ui-quality-check#build',
  ]);
  expect(planWarnings(plan)).toEqual([]);
  const wrong = {
    ...plan,
    shards: plan.shards.map((s) =>
      s.index === 3 ? { ...s, stage: 'checks' as const } : s
    ),
  };
  expect(() => validatePlan(wrong)).toThrow('Cross-shard dependency');
});

test('highly skewed durations balance by cost rather than count', () => {
  const tasks = [
    ...Array.from({ length: 16 }, (_, i) => task(`heavy-${i}`, 100)),
    ...Array.from({ length: 640 }, (_, i) => task(`small-${i}`, 1)),
  ];
  const checks = balanceShards(tasks, 16).shards.slice(0, 16);
  expect(checks.every((s) => s.seconds === 140)).toBe(true);
});

test('unknown families use a median; unmeasured families reserve 60 seconds and spread across shards', () => {
  expect(
    estimateTask('new#test:spec:9', {
      'a#test:spec:0': 20,
      'b#test:spec:1': 30,
      'c#test:spec:2': 1000,
    })
  ).toEqual({ seconds: 30, durationSource: 'family' });
  const tasks = Array.from({ length: 64 }, (_, i) => ({
    ...task(`new-${i}#unknown`),
    ...estimateTask(`new-${i}#unknown`, {}),
  }));
  const plan = balanceShards(tasks, 16);
  expect(
    plan.shards
      .slice(0, 16)
      .every((s) => s.tasks.length === 4 && s.seconds === 240)
  ).toBe(true);
  expect(planWarnings(plan)).toEqual([]);
});

test('cached tasks have zero execution weight and do not collapse into the first shard', () => {
  const tasks = [
    task('expensive', 100),
    task('cheap', 100),
    ...Array.from({ length: 20 }, (_, i) => ({
      ...task(`cached-${i}`, 1000),
      hit: true,
      source: 'REMOTE' as const,
    })),
  ];
  const checks = balanceShards(tasks, 2).shards.slice(0, 2);
  expect(checks.map((s) => s.seconds)).toEqual([100, 100]);
  expect(checks.map((s) => s.tasks.length)).toEqual([11, 11]);
});

test('imbalance validation warns about load and unknown concentration', () => {
  const plan = balanceShards([task('huge', 1000), task('tiny', 1)], 2);
  expect(planWarnings(plan).join(' ')).toContain('max/min exceeds 1.25');
  expect(planWarnings(plan).join(' ')).toContain('more than 20%');
  const unknowns = Array.from({ length: 16 }, (_, i) => ({
    ...task(`unknown-${i}`),
    durationSource: 'fallback' as const,
  }));
  const bad = {
    ...plan,
    shards: plan.shards.map((s) =>
      s.index === 0 ? { ...s, tasks: [...s.tasks, ...unknowns] } : s
    ),
  };
  expect(planWarnings(bad).join(' ')).toContain(
    'Unknown-duration tasks concentrated'
  );
});

test('renderer setup only serves uncached native browser tasks', () => {
  expect(needsBrowser([task('@apps/product#test:contract')])).toBe(true);
  expect(needsBrowser([task('@pkgs/ui-testing-bun-webview#test')])).toBe(true);
  expect(
    needsBrowser([{ ...task('@apps/product#test:contract'), hit: true }])
  ).toBe(false);
  expect(needsBrowser([task('@apps/product#tc')])).toBe(false);
});

test('progress and live timeouts use virtual time and completed artifacts, never stdout silence', () => {
  let now = 0;
  let completed = false;
  const logs: string[] = [];
  const stream = taskStream([task('slow')], (line) => logs.push(line), {
    now: () => now,
    completed: () => completed,
  });
  stream(
    JSON.stringify({
      source: 'slow',
      text: 'cache miss, executing 0123456789abcdef',
      level: 'info',
    })
  );
  now = 30000;
  stream.heartbeat();
  expect(logs.join(' ')).toContain('START slow');
  expect(logs.join(' ')).toContain('slow 30s');
  expect(stream.tick()).toEqual([]);
  now = 600001;
  expect(stream.tick()).toEqual(['slow']);
  expect(logs.join(' ')).toContain('TIMEOUT slow');
  completed = true;
  expect(stream.tick()).toEqual([]);
  expect(logs.join(' ')).toContain('COMPLETE slow');
  now = 1000000;
  expect(stream.tick()).toEqual([]);
});

test('shared generated artifacts get a prerequisite owner instead of binding every consumer', () => {
  const tasks = [
    task('generate', 10),
    ...Array.from({ length: 16 }, (_, i) =>
      task(`consumer-${i}`, 100, ['generate'])
    ),
  ];
  const plan = balanceShards(tasks, 16);
  expect(
    plan.shards
      .slice(0, 16)
      .every((shard) => shard.seconds === 100 && shard.tasks.length === 1)
  ).toBe(true);
  expect(plan.shards[16]!.tasks.map((task) => task.taskId)).toEqual([
    'generate',
  ]);
  expect(plan.shards).toEqual(balanceShards([...tasks].reverse(), 16).shards);
});
