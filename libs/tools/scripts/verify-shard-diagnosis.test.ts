import { expect, test } from 'bun:test';
import type { ShardFacts } from './verify-shard-diagnosis';
import { diagnoseShard, neverStarted } from './verify-shard-diagnosis';

const planned = ['a', 'b', 'c', 'd'].map((name) => ({
  taskId: `@libs/${name}#test`,
  command: `bun test ${name}`,
  seconds: 100,
  hit: false,
}));

function facts(overrides: Partial<ShardFacts>): ShardFacts {
  return {
    index: 62,
    stop: null,
    planned,
    estimatedSeconds: 400,
    actualSeconds: 90,
    stream: { running: [], finished: [], failed: [], overBudget: [] },
    summaryFailures: [],
    missingPrerequisites: [],
    budgetOverruns: '',
    ...overrides,
  };
}

test('a deadline says it is a timeout, names what was running and what never started', () => {
  const diagnosis = diagnoseShard(
    facts({
      stop: { kind: 'shard-deadline', deadlineSeconds: 1200 },
      actualSeconds: 1202,
      stream: {
        running: [{ taskId: '@libs/b#test', seconds: 66 }],
        finished: [{ taskId: '@libs/a#test', seconds: 900 }],
        failed: [],
        overBudget: [],
      },
    })
  );
  expect(diagnosis.kind).toBe('shard-deadline');
  expect(diagnosis.headline).toContain('RAN OUT OF TIME (1200s deadline)');
  expect(diagnosis.headline).toContain('no test in it was shown to be wrong');
  expect(diagnosis.text).toContain('NOT a failing test');
  expect(diagnosis.text).toContain('STILL RUNNING WHEN IT WAS KILLED');
  expect(diagnosis.text).toContain('@libs/b#test  running 66s');
  expect(diagnosis.text).toContain('bun test b');
  expect(diagnosis.text).toContain('NEVER STARTED (2)');
  expect(diagnosis.text).toContain('@libs/a#test  took 900s (planned 100s)');
  expect(diagnosis.text).toContain('verify-task-costs.ts --harvest');
  expect(diagnosis.markdown).toContain('## ❌ Verify shard 62 RAN OUT OF TIME');
});

test('a failed task shows its command, exit detail and the end of its output', () => {
  const diagnosis = diagnoseShard(
    facts({
      stream: {
        running: [],
        finished: [],
        failed: [
          {
            taskId: '@libs/c#test',
            seconds: 12,
            detail: 'error: script "test" exited with code 1',
            tail: 'expected 1\nreceived 2',
          },
        ],
        overBudget: [],
      },
    })
  );
  expect(diagnosis.kind).toBe('task-failed');
  expect(diagnosis.headline).toBe(
    'Verify shard 62 FAILED: 1 task failed — @libs/c#test'
  );
  expect(diagnosis.text).toContain('command: bun test c');
  expect(diagnosis.text).toContain('| expected 1');
  expect(diagnosis.text).toContain('| received 2');
  expect(diagnosis.text).not.toContain('NEVER STARTED');
});

test('a stop with no failing task and no timeout is called incomplete, not a task failure', () => {
  const diagnosis = diagnoseShard(facts({}));
  expect(diagnosis.kind).toBe('incomplete');
  expect(diagnosis.text).toContain('NEVER STARTED (4)');
});

test('a task over its own budget is named with the budget it exceeded', () => {
  const diagnosis = diagnoseShard(
    facts({
      stop: { kind: 'task-budget' },
      stream: {
        running: [{ taskId: '@libs/d#test', seconds: 700 }],
        finished: [],
        failed: [],
        overBudget: [{ taskId: '@libs/d#test', seconds: 700, budget: 600 }],
      },
    })
  );
  expect(diagnosis.kind).toBe('task-budget');
  expect(diagnosis.text).toContain('ran 700s, budget 600s');
  expect(neverStarted(facts({})).length).toBe(4);
});
