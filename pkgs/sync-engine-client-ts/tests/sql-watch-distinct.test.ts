import { expect, test } from 'bun:test';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { createSqlWatch } from '@pkgs/sync-engine-client-ts/sql-watch';
import { createTableChangeBus } from '@pkgs/sync-engine-client-ts/table-change-bus';

type Row = { id: string; value: number };

// regression: sql-watch-unchanged-rows-repaint
test('a table change with the same Alice row keeps its snapshot and notification count', async () => {
  const bus = createTableChangeBus();
  let rows: Row[] = [{ id: 'alice', value: 7 }];
  const db: Pick<SqlClient, 'query'> = {
    query: async <T extends Record<string, unknown>>() => {
      const result: Record<string, unknown>[] = structuredClone(rows);
      return result as T[];
    },
  };
  const watch = createSqlWatch({
    db,
    bus,
    query: sql<Row>`SELECT id, value FROM people`,
  });
  let notifications = 0;
  watch.subscribe(() => notifications++);
  try {
    await Promise.resolve();
    const first = watch.getSnapshot();
    expect(first).toEqual([{ id: 'alice', value: 7 }]);
    expect(watch.getHydrated()).toBe(true);
    expect(notifications).toBe(1);
    bus.emit(['people']);
    await Promise.resolve();
    expect(watch.getSnapshot()).toBe(first);
    expect(notifications).toBe(1);
    rows = [
      { id: 'alice', value: 8 },
      { id: 'bob', value: 9 },
    ];
    bus.emit(['people']);
    await Promise.resolve();
    expect(watch.getSnapshot()).toEqual(rows);
    expect(notifications).toBe(2);
    // regression: sql-watch-unchanged-neighbor-repaints
    const bob = watch.getSnapshot()[1];
    rows = [
      { id: 'alice', value: 10 },
      { id: 'bob', value: 9 },
    ];
    bus.emit(['people']);
    await Promise.resolve();
    expect(watch.getSnapshot()[1]).toBe(bob);
    expect(notifications).toBe(3);
    rows.reverse();
    bus.emit(['people']);
    await Promise.resolve();
    expect(watch.getSnapshot()).toEqual(rows);
    expect(notifications).toBe(4);
  } finally {
    watch.close();
  }
});

test('an empty first read still hydrates once; irrelevant and identical changes stay quiet', async () => {
  const bus = createTableChangeBus();
  const watch = createSqlWatch({
    db: { query: async () => [] },
    bus,
    query: sql<Row>`SELECT id, value FROM people`,
  });
  let notifications = 0;
  watch.subscribe(() => notifications++);
  try {
    expect(watch.getHydrated()).toBe(false);
    await Promise.resolve();
    expect(watch.getHydrated()).toBe(true);
    expect(notifications).toBe(1);
    bus.emit(['other_table']);
    bus.emit(['people']);
    await Promise.resolve();
    expect(watch.getSnapshot()).toEqual([]);
    expect(notifications).toBe(1);
  } finally {
    watch.close();
  }
});
