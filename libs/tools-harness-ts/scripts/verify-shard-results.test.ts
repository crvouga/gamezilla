import { expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';
import type { Result } from './verify-shard-results';
import { collectResults, completeResults } from './verify-shard-results';
import type { VerifyPlan, VerifyTask } from './verify-shards';

function task(taskId: string, hit = false): VerifyTask {
  return {
    taskId,
    hash: 'b65ff77a9d840001',
    hit,
    source: hit ? 'LOCAL' : null,
    dependencies: [],
    command: 'bun run scripts/ui-quality/check.ts',
    directory: 'apps/product-ts',
    seconds: 300,
    durationSource: 'fallback',
  };
}

// regression: release-costs-erased-by-pr-profile
test('a task still running when the shard stops records how long it ran', () => {
  const tasks = [
    task('@libs/games#test:spec:2'),
    task('@libs/games#test:spec:3'),
  ];
  const completed = completeResults(tasks, [], 124, [
    { taskId: '@libs/games#test:spec:2', seconds: 497.2 },
  ]);
  expect(completed).toEqual([
    expect.objectContaining({
      taskId: '@libs/games#test:spec:2',
      passed: false,
      interrupted: true,
      milliseconds: 0,
      ranForMs: 497_200,
    }),
    expect.objectContaining({
      taskId: '@libs/games#test:spec:3',
      interrupted: true,
      milliseconds: 0,
    }),
  ]);
  expect(completed[1]).not.toHaveProperty('ranForMs');
});

test('a killed visual consumer retains its failed verdict and exact planned hash', () => {
  // regression: verify-timeout-drops-task-evidence — Verification xlnk3h10bl killed the visual consumer at 600s without a Turbo summary.
  const tasks = [task('@apps/product-ts#verify:ui-quality')];
  const shard = { index: 17, stage: 'consumers' as const, seconds: 300, tasks };
  const plan: VerifyPlan = { version: 2, tasks, shards: [shard] };
  const result = collectResults({
    plan,
    shard,
    summary: null,
    needed: new Set(),
    status: 124,
    env: {},
  });
  expect(result.verdict).toBe(124);
  expect(result.results).toEqual([
    {
      taskId: tasks[0]!.taskId,
      hash: tasks[0]!.hash,
      passed: false,
      cache: 'MISS',
      milliseconds: 0,
      exitCode: 124,
      interrupted: true,
    },
  ]);
});

test('missing task verdicts fail closed without changing any recorded result', async () => {
  await assertProperty(
    'interrupted-shards-retain-all-verdicts',
    fc.asyncProperty(
      fc.array(fc.constantFrom('passed', 'failed', 'missing'), {
        maxLength: 30,
      }),
      fc.constantFrom(0, 1, 124, 137),
      async (states, status) => {
        const tasks = states.map((_, i) => task(`@libs/chess#test:spec:${i}`));
        const recorded: Result[] = tasks.flatMap((t, i) =>
          states[i] === 'missing'
            ? []
            : [
                {
                  taskId: t.taskId,
                  hash: t.hash,
                  passed: states[i] === 'passed',
                  cache: 'MISS',
                  milliseconds: 123,
                  exitCode: states[i] === 'passed' ? 0 : 1,
                },
              ]
        );
        const completed = completeResults(tasks, recorded, status);
        expect(completed).toHaveLength(tasks.length);
        expect(completed.slice(0, recorded.length)).toEqual(recorded);
        for (const [i, t] of tasks.entries()) {
          const result = completed.find((r) => r.taskId === t.taskId)!;
          expect(result.hash).toBe(t.hash);
          expect(result.passed).toBe(states[i] === 'passed');
          if (states[i] === 'missing') {
            expect(result.exitCode).not.toBe(0);
            expect(result.milliseconds).toBe(0);
            expect(result.interrupted).toBe(true);
          }
        }
        expect(completeResults(tasks, completed, status)).toEqual(completed);
      }
    )
  );
});
