import { describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  measuredCosts,
  mergeCosts,
  readScheduleCosts,
  readTaskCosts,
} from './check-task-costs';

describe('mergeCosts', () => {
  const summary = (tasks: [string, number, 'HIT' | 'MISS'][]): string =>
    JSON.stringify({
      tasks: tasks.map(([taskId, seconds, status]) => ({
        taskId,
        cache: { status },
        execution: { startTime: 0, endTime: seconds * 1000 },
      })),
    });

  test('measured tasks replace old costs; unmeasured ones stay', () => {
    expect(
      mergeCosts({ '@p/a#tc': 3, '@p/b#lint': 9 }, [
        summary([['@p/a#tc', 7, 'MISS']]),
      ])
    ).toEqual({ '@p/a#tc': 7, '@p/b#lint': 9 });
  });

  test('sanitized shard evidence supplies costs without cached task timings', () => {
    expect(
      mergeCosts({}, [
        JSON.stringify({
          tasks: [
            { taskId: '@p/a#tc', cache: 'MISS', milliseconds: 4200 },
            { taskId: '@p/b#tc', cache: 'HIT', milliseconds: 0 },
          ],
        }),
      ])
    ).toEqual({ '@p/a#tc': 4 });
  });

  test('a task two shards ran keeps the larger; a cache hit measures nothing', () => {
    expect(
      mergeCosts({ '@p/c#test': 50 }, [
        summary([
          ['@p/a#tc', 4, 'MISS'],
          ['@p/c#test', 1, 'HIT'],
        ]),
        summary([['@p/a#tc', 6, 'MISS']]),
      ])
    ).toEqual({ '@p/a#tc': 6, '@p/c#test': 50 });
  });
});

// regression: check-failed-task-duration-history
test('failed, killed, zero and invalid timings do not poison history', () => {
  const summaries = [
    JSON.stringify({
      tasks: [
        {
          taskId: 'failed',
          cache: 'MISS',
          milliseconds: 1200000,
          passed: false,
        },
        {
          taskId: 'raw-failed',
          cache: { status: 'MISS' },
          execution: { startTime: 0, endTime: 1200000, exitCode: 1 },
        },
        { taskId: 'zero', cache: 'MISS', milliseconds: 0 },
        { taskId: 'negative', cache: 'MISS', milliseconds: -1 },
        { taskId: 'ok', cache: 'MISS', milliseconds: 4500, passed: true },
      ],
    }),
  ];
  expect(mergeCosts({ failed: 5 }, summaries)).toEqual({ failed: 5, ok: 5 });
});

describe('measured costs', () => {
  const planned = [
    { taskId: '@p/a#test:spec:0', seconds: 17, durationSource: 'family' },
    { taskId: '@p/a#test:spec:1', seconds: 40, durationSource: 'history' },
    { taskId: '@p/b#lint', seconds: 3, durationSource: 'history' },
    { taskId: '@p/c#tc', seconds: 60, durationSource: 'fallback' },
    { taskId: '@p/d#test', seconds: 9, durationSource: 'history' },
  ];
  const result = (
    taskId: string,
    milliseconds: number,
    cache = 'MISS',
    passed = true
  ) => ({ taskId, milliseconds, cache, passed });

  test('a run records what it executed and keeps what it only restored', () => {
    expect(
      measuredCosts(planned, [
        result('@p/a#test:spec:0', 208_400),
        result('@p/a#test:spec:1', 0, 'HIT'),
        result('@p/b#lint', 400),
        // Failed and interrupted tasks measure nothing.
        result('@p/d#test', 600_000, 'MISS', false),
        // A task outside the plan is not carried into the next one.
        result('@old/gone#test', 5000),
      ])
    ).toEqual({
      '@p/a#test:spec:0': 208,
      '@p/a#test:spec:1': 40,
      '@p/b#lint': 1,
      '@p/d#test': 9,
    });
  });

  test('the schedule overlays restored measurements on the committed costs', () => {
    const fixture = mkdtempSync(join(tmpdir(), 'check-costs-'));
    const path = join(fixture, 'measured-costs.json');
    try {
      const committed = readTaskCosts();
      expect(readScheduleCosts(path)).toEqual(committed);
      const [known] = Object.keys(committed) as [string];
      writeFileSync(
        path,
        JSON.stringify({
          [known]: 4321,
          '@p/new#test:spec:0': 208,
          '@p/bad#test': 'slow',
          '@p/zero#test': 0,
        })
      );
      expect(readScheduleCosts(path)).toEqual({
        ...committed,
        [known]: 4321,
        '@p/new#test:spec:0': 208,
      });
      // Packing never decides a verdict: an unreadable overlay is ignored.
      writeFileSync(path, 'not json');
      expect(readScheduleCosts(path)).toEqual(committed);
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  });
});
