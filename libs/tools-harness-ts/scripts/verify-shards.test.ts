import { expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';
import { needsBrowser } from './verify-browser-tasks';
import { CI_RUN_DEADLINE_SECONDS, taskBudgetSeconds } from './verify-budget';
import { redactSecrets, taskStream } from './verify-shard-stream';
import type { VerifyTask } from './verify-shards';
import {
  adaptiveShardTarget,
  balanceShards,
  executes,
  planWarnings,
  validatePlan,
  validateShardResult,
} from './verify-shards';
import { publishedTasks, requiredTasks } from './verify-stage-cache';
import { estimateScheduledTask, estimateTask } from './verify-task-estimates';

function task(
  id: string,
  seconds = 1,
  dependencies: string[] = []
): VerifyTask {
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

// regression: github-model-verifications-share-solver-slot
test('cold chess, board and room model verifications use separate runners', () => {
  const tasks = [
    task('@libs/chess-root-harness-ts#verify:models', 16),
    task('@pkgs/chess-board-root-harness-ts#verify:models', 16),
    task('@pkgs/room-root-harness-ts#verify:models', 18),
    ...Array.from({ length: 20 }, (_, i) => task(`pkg-${i}#test`, 30)),
  ];
  const plan = balanceShards(tasks, 16);
  expect(
    plan.shards.filter((shard) =>
      shard.tasks.some((task) => task.taskId.endsWith('#verify:models'))
    )
  ).toHaveLength(3);
});

test('uncached solver groups spread evenly regardless of estimates and discovery order', () => {
  assertProperty(
    'verify-solver-shards',
    fc.property(
      fc.array(fc.integer({ min: 1, max: 1000 }), {
        minLength: 1,
        maxLength: 11,
      }),
      fc.integer({ min: 1, max: 16 }),
      (durations, count) => {
        const tasks = durations.map((seconds, i) =>
          task(`pkg-${i}#verify:models`, seconds)
        );
        tasks.push({ ...task('cached#verify:models'), hit: true });
        const plan = balanceShards(tasks, count);
        const sizes = plan.shards
          .slice(0, count)
          .map((shard) => shard.tasks.filter((task) => !task.hit).length);
        expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
        expect(plan.shards).toEqual(
          balanceShards([...tasks].reverse(), count).shards
        );
        validatePlan(plan);
      }
    )
  );
});

test('LPT preserves every input exactly once and is independent of discovery order', () => {
  assertProperty(
    'verify-balanced-partition',
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

test('producer chains share one shard without duplicating independent verifications', () => {
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

// regression: verify-opaque-task-failure
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

// regression: verify-ui-fanin-shard-collapse
test('shared builds and literal UI fan-in do not bind parallel tests to one owner', () => {
  const tasks = [
    task('ui-quality-check#build', 8),
    task('@apps/product-ts#tc', 2),
    task('@apps/product-ts#test:spec:0', 100),
    task('@libs/billing#test:spec:0', 100),
    task('@apps/product-ts#prepare:ui-quality', 5, [
      '@apps/product-ts#test:spec:0',
      '@libs/billing#test:spec:0',
    ]),
    task('@apps/product-ts#verify:ui-quality', 60, [
      '@apps/product-ts#prepare:ui-quality',
      '@apps/product-ts#tc',
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
      s.index === 3 ? { ...s, stage: 'verifications' as const } : s
    ),
  };
  expect(() => validatePlan(wrong)).toThrow('Cross-shard dependency');
});

test('highly skewed durations balance by cost rather than count', () => {
  const tasks = [
    ...Array.from({ length: 16 }, (_, i) => task(`heavy-${i}`, 100)),
    ...Array.from({ length: 640 }, (_, i) => task(`small-${i}`, 1)),
  ];
  const verifications = balanceShards(tasks, 16).shards.slice(0, 16);
  expect(verifications.every((s) => s.seconds === 140)).toBe(true);
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
  const verifications = balanceShards(tasks, 2).shards.slice(0, 2);
  expect(verifications.map((s) => s.seconds)).toEqual([100, 100]);
  expect(verifications.map((s) => s.tasks.length)).toEqual([11, 11]);
});

test('imbalance validation warns about load and unknown concentration', () => {
  const tasks = [
    task('huge-a', 500),
    task('huge-b', 500),
    task('tiny-a'),
    task('tiny-b'),
  ];
  const balanced = balanceShards(tasks, 2);
  const plan = {
    ...balanced,
    shards: balanced.shards.map((shard, index) =>
      index < 2
        ? {
            ...shard,
            tasks: tasks.slice(index * 2, index * 2 + 2),
            seconds: index === 0 ? 1000 : 2,
          }
        : shard
    ),
  };
  validatePlan(plan);
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

// regression: verify-dedicated-solver-balance-warning
test('dedicated solver runners are not a pack imbalance', () => {
  // Verify run 38239315522: proof runners of 9–86s sat beside an even pack,
  // and the unknown-duration tasks lived on that pack. Comparing the proofs
  // with the pack warned about max/min, the heaviest shard, and concentration.
  const solvers = [
    task('@apps/product-ts#test:contract', 86),
    task('@pkgs/matchmaking-root-harness-ts#verify:models', 9),
    ...Array.from({ length: 10 }, (_, index) => ({
      ...task(`@libs/chess-root-harness-ts#verify:models:${index}`, 16),
      durationSource: 'family' as const,
    })),
  ];
  const packed = Array.from({ length: 144 }, (_, index) => ({
    ...task(`pkg-${index}#test`, 5),
    durationSource: 'fallback' as const,
  }));
  const plan = balanceShards([...solvers, ...packed], 40, 60);
  const pack = plan.shards.filter(
    (shard) =>
      shard.stage === 'verifications' &&
      executes(shard) &&
      shard.tasks.some((item) => item.taskId.startsWith('pkg-'))
  );
  expect(pack.map((shard) => shard.seconds)).toEqual(Array(12).fill(60));
  expect(planWarnings(plan)).toEqual([]);
  validatePlan(plan);
});

// regression: verify-cold-corpus-overfills-forty-shards
test('a cold corpus stays bounded at both forty and sixty-four runners', () => {
  // Verify run 38328597240: 27 solver runners inside a cap of 40 packed the
  // other 5034 estimated seconds into shards of 376s, which were still
  // running at the 1200s deadline. Sharing spare proof capacity now keeps
  // both caps under a quarter of that deadline, with every task retained.
  const solvers = [
    task('@apps/product-ts#test:contract', 86),
    ...Array.from({ length: 26 }, (_, index) =>
      task(`@libs/pkg-${index}#verify:models`, 12)
    ),
  ];
  const packed = Array.from({ length: 839 }, (_, index) =>
    task(`pkg-${index}#test`, 6)
  );
  const heaviest = (count: number) => {
    const tasks = [...solvers, ...packed];
    const plan = balanceShards(tasks, count, 60);
    validatePlan(plan);
    expect(
      plan.shards
        .flatMap((shard) => shard.tasks.map((item) => item.taskId))
        .sort()
    ).toEqual(tasks.map((item) => item.taskId).sort());
    const bins = plan.shards.filter(
      (shard) =>
        shard.stage === 'verifications' &&
        executes(shard) &&
        shard.tasks.some((item) => item.taskId.startsWith('pkg-'))
    );
    return Math.max(...bins.map((shard) => shard.seconds));
  };
  expect(heaviest(40) * 4).toBeLessThanOrEqual(CI_RUN_DEADLINE_SECONDS);
  expect(heaviest(64) * 4).toBeLessThanOrEqual(CI_RUN_DEADLINE_SECONDS);
});

test('renderer setup only serves uncached native browser tasks', () => {
  // regression: deploy-journeys-missing-pr-browser-gate
  expect(needsBrowser([task('@apps/product-ts#test:release-journeys:1')])).toBe(
    true
  );
  expect(needsBrowser([task('@apps/product-ts#test:contract:render')])).toBe(
    true
  );
  expect(needsBrowser([task('@apps/product-ts#test:contract')])).toBe(false);
  expect(
    needsBrowser([task('@pkgs/ui-testing-bun-webview-server-ts#test')])
  ).toBe(true);
  expect(
    needsBrowser([
      { ...task('@apps/product-ts#test:contract:render'), hit: true },
    ])
  ).toBe(false);
  expect(needsBrowser([task('@apps/product-ts#tc')])).toBe(false);
});

test('progress and live timeouts use virtual time and completed artifacts, never stdout silence', () => {
  let now = 0;
  let completed = false;
  const logs: string[] = [];
  const stream = taskStream([task('slow')], (line) => logs.push(line), {
    now: () => now,
    completed: () => completed,
    env: { ...process.env, VERIFY_TIME_LIMITS: 'on' },
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
  // regression: randomized-budget-tests-inherit-nightly
  now =
    taskBudgetSeconds('slow', true, {
      ...process.env,
      VERIFY_TIME_LIMITS: 'on',
    }) *
      1000 +
    1;
  expect(stream.tick()).toEqual(['slow']);
  expect(logs.join(' ')).toContain('TIMEOUT slow');
  completed = true;
  expect(stream.tick()).toEqual([]);
  expect(logs.join(' ')).toContain('COMPLETE slow');
  now += 1000000;
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

test('a shard target starts only the runners the uncached work needs', () => {
  const cached = Array.from({ length: 500 }, (_, i) => ({
    ...task(`cached-${i}#tc`, 30),
    hit: true,
    source: 'REMOTE' as const,
  }));
  const misses = Array.from({ length: 6 }, (_, i) =>
    task(`leaf-${i}#test`, 50)
  );
  const plan = balanceShards([...cached, ...misses], 32, 120);
  const started = plan.shards.filter(
    (shard) => shard.stage === 'verifications' && executes(shard)
  );
  // 300 s of work at 120 s a shard, not thirty-two runners of ten seconds.
  expect(started.map((shard) => shard.index)).toEqual([0, 1, 2]);
  expect(started.map((shard) => shard.seconds)).toEqual([100, 100, 100]);
  expect(plan.shards).toHaveLength(34);
  expect(
    plan.shards.slice(3, 32).every((shard) => shard.tasks.length === 0)
  ).toBe(true);
  expect(planWarnings(plan)).toEqual([]);
  validatePlan(plan);
});

// regression: verify-shard-width-counts-oversized-group
test('a task longer than the shard target starts no runner for a few seconds of work', () => {
  // Verify run 38198242466: a 133 s task and a 97 s task counted as four
  // runners at 60 s a shard, so 15 s, 9 s and 2 s of work each paid a
  // runner's setup. The 133 s task was the population image build, which
  // the gate no longer runs; the duration stays as the oversized fixture.
  const plan = balanceShards(
    [
      task('@apps/product-ts#test:contract', 86),
      task('@libs/chess-root-harness-ts#verify:models', 35),
      task(
        '@apps/synthetic-population-worker-ts#verify:synthetic-population',
        133
      ),
      task('@libs/chess-root-harness-ts#test:spec:33', 97),
      task('@libs/tools-harness-ts#test', 15),
      task('@libs/tools-harness-ts#verify:root-lint', 9),
      task('@libs/tools-harness-ts#verify:secrets', 1),
      task('@libs/tools-harness-ts#ci:spec-ownership', 1),
    ],
    40,
    60
  );
  const started = plan.shards.filter(
    (shard) => shard.stage === 'verifications' && executes(shard)
  );
  expect(
    started.map((shard) => shard.tasks.map((item) => item.taskId))
  ).toEqual([
    ['@apps/product-ts#test:contract'],
    ['@libs/chess-root-harness-ts#verify:models'],
    ['@apps/synthetic-population-worker-ts#verify:synthetic-population'],
    ['@libs/chess-root-harness-ts#test:spec:33'],
    [
      '@libs/tools-harness-ts#test',
      '@libs/tools-harness-ts#verify:root-lint',
      '@libs/tools-harness-ts#ci:spec-ownership',
      '@libs/tools-harness-ts#verify:secrets',
    ],
  ]);
  expect(started.map((shard) => shard.seconds)).toEqual([86, 35, 133, 97, 26]);
  validatePlan(plan);
});

test('a fully cached plan starts no shard, and a cold corpus uses every one', () => {
  const tasks = Array.from({ length: 200 }, (_, i) =>
    task(`pkg-${i}#test`, 90)
  );
  const cached = balanceShards(
    tasks.map((item) => ({ ...item, hit: true, source: 'REMOTE' as const })),
    32,
    120
  );
  expect(cached.shards.filter(executes)).toEqual([]);
  expect(cached.shards[0]!.tasks).toHaveLength(200);
  expect(planWarnings(cached)).toEqual([]);
  const cold = balanceShards(tasks, 32, 120);
  expect(cold.shards.slice(0, 32).every(executes)).toBe(true);
});

// regression: solver-timeout-ends-unrelated-tasks
test('a narrowed plan leaves each uncached solver group alone on its runner', () => {
  // Verify run 38190147513: the chess model verification outran its 600 s budget
  // and the five spec parts queued behind it on shard 6 ended unrun.
  const plan = balanceShards(
    [
      task('@libs/chess-root-harness-ts#verify:models', 5),
      // A part of a split models verification is a solver task like the whole.
      task('@libs/chess-root-harness-ts#verify:models:7', 5),
      task('@libs/profile-harness-ts#verify:models:2:8', 5),
      // Verify run 38195467632: its thirteen proofs outran the task budget
      // and 39 tasks queued on shard 25 ended unrun.
      task('@apps/product-ts#test:contract', 5),
      ...Array.from({ length: 6 }, (_, i) =>
        task(`@libs/chess-root-harness-ts#test:spec:${i}`, 50)
      ),
      { ...task('cached#tc', 30), hit: true },
    ],
    16,
    120
  );
  const started = plan.shards.filter(executes);
  // Four solver runners, and 300 s of spec work at 120 s a shard.
  expect(started).toHaveLength(7);
  const solverShards = started.filter((shard) =>
    shard.tasks.some(
      (item) =>
        /#verify:models(?::\d+){0,2}$/.test(item.taskId) ||
        item.taskId === '@apps/product-ts#test:contract'
    )
  );
  expect(solverShards).toHaveLength(4);
  expect(solverShards.every((shard) => shard.tasks.length === 1)).toBe(true);
  expect(plan.shards).toEqual(
    balanceShards([...plan.tasks].reverse(), 16, 120).shards
  );
  validatePlan(plan);
  // With a runner for every shard already taken by a solver, the rest share.
  const crowded = balanceShards(
    [
      task('a#verify:models', 5),
      task('b#verify:models', 5),
      task('pkg#test', 5),
    ],
    2,
    120
  );
  expect(crowded.shards.filter(executes)).toHaveLength(2);
  validatePlan(crowded);
});

// regression: product-contract-outlasts-one-runner
test('each product contract part stays alone on its runner', () => {
  const parts = Array.from({ length: 11 }, (_, index) =>
    task(`@apps/product-ts#test:contract:${String(index)}`, 20)
  );
  const plan = balanceShards(
    [
      ...parts,
      task('@apps/product-ts#test:contract:render', 10),
      task('pkg#test', 10),
    ],
    64,
    60
  );
  const solvers = plan.shards.filter(
    (shard) =>
      executes(shard) &&
      shard.tasks.some((item) =>
        /@apps\/product-ts#test:contract:\d+$/.test(item.taskId)
      )
  );
  expect(solvers).toHaveLength(11);
  expect(solvers.every((shard) => shard.tasks.length === 1)).toBe(true);
  const packed = plan.shards.find((shard) =>
    shard.tasks.some((item) => item.taskId === 'pkg#test')
  );
  expect(packed?.tasks.map((item) => item.taskId).sort()).toEqual([
    '@apps/product-ts#test:contract:render',
    'pkg#test',
  ]);
});

test('a narrowed plan keeps every task exactly once in any discovery order', () => {
  assertProperty(
    'verify-narrowed-partition',
    fc.property(
      fc.array(
        fc.record({
          seconds: fc.integer({ min: 1, max: 600 }),
          hit: fc.boolean(),
        }),
        { minLength: 1, maxLength: 300 }
      ),
      fc.integer({ min: 1, max: 64 }),
      fc.integer({ min: 1, max: 900 }),
      (specs, count, target) => {
        const tasks = specs.map(({ seconds, hit }, index) => ({
          ...task(`package-${index}#test`, seconds),
          hit,
        }));
        const plan = balanceShards(tasks, count, target);
        expect(plan.shards).toEqual(
          balanceShards([...tasks].reverse(), count, target).shards
        );
        expect(
          plan.shards
            .flatMap((shard) => shard.tasks.map((item) => item.taskId))
            .sort()
        ).toEqual(tasks.map((item) => item.taskId).sort());
        validatePlan(plan);
        const work = tasks.reduce(
          (sum, item) => sum + (item.hit ? 0 : item.seconds),
          0
        );
        expect(plan.shards.filter(executes).length).toBeLessThanOrEqual(
          Math.min(count, Math.max(1, Math.ceil(work / target)))
        );
      }
    )
  );
});

test('an unmeasured spec part is estimated from its own suite before the family', () => {
  const costs = {
    '@libs/chess-root-harness-ts#test:spec:0': 300,
    '@libs/chess-root-harness-ts#test:spec:1': 200,
    '@libs/chess-root-harness-ts#test:spec:2': 250,
    '@libs/runtime-harness-ts#test:spec:0': 8,
    '@libs/runtime-harness-ts#test:spec:1': 10,
    '@libs/runtime-harness-ts#test:spec:2': 12,
    '@libs/runtime-harness-ts#test:spec:3': 9,
  };
  expect(
    estimateScheduledTask('@libs/chess-root-harness-ts#test:spec:9', costs)
  ).toEqual({ seconds: 250, durationSource: 'family' });
  expect(
    estimateScheduledTask('@libs/runtime-harness-ts#test:spec:9', costs)
  ).toEqual({ seconds: 10, durationSource: 'family' });
  // Its own measurement wins; a suite with no sample falls back to the family.
  expect(
    estimateScheduledTask('@libs/chess-root-harness-ts#test:spec:0', costs)
  ).toEqual({ seconds: 300, durationSource: 'history' });
  expect(estimateScheduledTask('@libs/new-harness#test:spec:0', costs)).toEqual(
    estimateTask('@libs/new-harness#test:spec:0', costs)
  );
  expect(estimateScheduledTask('@libs/new-harness#lint', costs)).toEqual({
    seconds: 60,
    durationSource: 'fallback',
  });
});

// regression: verify-failed-task-reported-as-timeout
test('a task whose script exited non-zero is over, not "running" until its budget', () => {
  let now = 0;
  const logs: string[] = [];
  const stream = taskStream(
    [task('@libs/tools-harness-ts#ci:x')],
    (l) => logs.push(l),
    {
      now: () => now,
      completed: () => false,
    }
  );
  const send = (text: string, level = 'info') =>
    stream(
      JSON.stringify({ source: '@libs/tools-harness-ts#ci:x', text, level })
    );
  send('cache miss, executing 0123456789abcdef');
  now = 40;
  send('spec ownership verification failed: ...');
  send('error: script "ci:x" exited with code 1');
  now = 1_000_000;
  expect(stream.tick()).toEqual([]);
  expect(logs.join('\n')).not.toContain('TIMEOUT');
  expect(stream.snapshot().running).toEqual([]);
  expect(stream.snapshot().failed.map((failed) => failed.taskId)).toEqual([
    '@libs/tools-harness-ts#ci:x',
  ]);
});

test('a plan never starts more shards than the runners that can take them, and loses no task', () => {
  assertProperty(
    'verify-runner-cap',
    fc.property(
      fc.array(fc.integer({ min: 1, max: 600 }), {
        minLength: 1,
        maxLength: 80,
      }),
      fc.integer({ min: 1, max: 64 }),
      fc.integer({ min: 1, max: 64 }),
      (seconds, count, runners) => {
        const tasks = seconds.map((s, i) => task(`pkg-${i}#test`, s));
        const plan = balanceShards(tasks, count, 180, {
          runners,
          fillSeconds: 720,
        });
        const started = plan.shards.filter(
          (shard) => shard.stage === 'verifications' && shard.tasks.length > 0
        );
        // More shards than runners only when the runners cannot hold the
        // work inside a shard's deadline.
        if (started.length > Math.min(count, runners))
          expect(
            balanceShards(tasks, count, 720).shards.filter(
              (shard) =>
                shard.stage === 'verifications' && shard.tasks.length > 0
            ).length
          ).toBeGreaterThan(runners);
        expect(
          plan.shards
            .filter((shard) => shard.stage === 'verifications')
            .flatMap((shard) => shard.tasks.map((t) => t.taskId))
            .sort()
        ).toEqual(tasks.map((t) => t.taskId).sort());
        // The prerequisite stage keeps index `count`, which the workflow names.
        expect(
          plan.shards.find((shard) => shard.stage === 'prerequisites')?.index
        ).toBe(count);
      }
    )
  );
});

const startedShards = (plan: ReturnType<typeof balanceShards>) =>
  plan.shards.filter(
    (shard) => shard.stage === 'verifications' && shard.tasks.length > 0
  );

test('four runners take a corpus that fits their deadline in four shards instead of sixty-four', () => {
  const tasks = Array.from({ length: 24 }, (_, i) => task(`pkg-${i}#test`, 90));
  const started = startedShards(
    balanceShards(tasks, 64, 180, { runners: 4, fillSeconds: 720 })
  );
  expect(started).toHaveLength(4);
  expect(Math.max(...started.map((s) => s.seconds))).toBe(540);
});

// Verify run 40577850573: 92 uncached proof parts each preferred a runner of
// their own, so four runners still got 64 shards.
test('proof lanes do not widen a small pool beyond what its deadline needs', () => {
  const tasks = [
    ...Array.from({ length: 90 }, (_, i) =>
      task(`@libs/p${i}-harness-ts#verify:models:${i}`, 30)
    ),
    ...Array.from({ length: 20 }, (_, i) => task(`pkg-${i}#test`, 30)),
  ];
  const started = startedShards(
    balanceShards(tasks, 64, 180, { runners: 4, fillSeconds: 720 })
  );
  expect(started).toHaveLength(5);
  expect(Math.max(...started.map((s) => s.seconds))).toBeLessThanOrEqual(720);
});

test('too few runners queue extra shards rather than overfill one past its deadline', () => {
  const tasks = Array.from({ length: 200 }, (_, i) =>
    task(`pkg-${i}#test`, 90)
  );
  const started = startedShards(
    balanceShards(tasks, 64, 180, { runners: 4, fillSeconds: 720 })
  );
  expect(started).toHaveLength(25);
  expect(Math.max(...started.map((s) => s.seconds))).toBeLessThanOrEqual(720);
});

const SIZING = { setupSeconds: 30, setupMultiple: 3, slots: 1 };

test('a shard holds a few times its setup, never less than the longest group, never past its deadline fill', () => {
  assertProperty(
    'verify-adaptive-shard-target',
    fc.property(
      fc.array(fc.integer({ min: 1, max: 900 }), {
        minLength: 1,
        maxLength: 60,
      }),
      fc.integer({ min: 1, max: 120 }),
      fc.integer({ min: 100, max: 2000 }),
      (seconds, setup, fill) => {
        const tasks = seconds.map((s, i) => task(`pkg-${i}#test`, s));
        const target = adaptiveShardTarget(
          tasks,
          { ...SIZING, setupSeconds: setup },
          fill
        );
        expect(target.longestGroupSeconds).toBe(Math.max(...seconds));
        expect(target.uncachedSeconds).toBe(seconds.reduce((a, b) => a + b, 0));
        expect(target.targetSeconds).toBe(
          Math.min(fill, Math.max(3 * setup, Math.max(...seconds)))
        );
      }
    )
  );
});

test('cached tasks size nothing', () => {
  const tasks = [{ ...task('a#test', 500), hit: true }, task('b#test', 40)];
  expect(adaptiveShardTarget(tasks, SIZING)).toEqual({
    targetSeconds: 90,
    uncachedSeconds: 40,
    longestGroupSeconds: 40,
    efficiencySeconds: 90,
  });
});

// Verify run 40577850573's pull-request share: 2,500 s of small tasks whose
// longest is 132 s. Shards smaller than that group cannot finish sooner.
test('more runners than useful shards start only the shards that shorten the run', () => {
  const tasks = Array.from({ length: 40 }, (_, i) =>
    task(`pkg-${i}#test`, i === 0 ? 132 : 60)
  );
  const target = adaptiveShardTarget(tasks, SIZING, 720);
  expect(target.targetSeconds).toBe(132);
  const started = balanceShards(tasks, 64, target.targetSeconds, {
    runners: 34,
    fillSeconds: 720,
  }).shards.filter(
    (shard) => shard.stage === 'verifications' && shard.tasks.length > 0
  );
  expect(started.length).toBeLessThan(34);
  expect(started.length).toBe(Math.ceil((132 + 39 * 60) / 132));
});
