import { describe, expect, test } from 'bun:test';
import { mergeCosts } from './check-task-costs';

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
