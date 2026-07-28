import { describe, expect, test } from 'bun:test';

import { honey } from '@pkgs/sql';

import { defineTable } from '../shared/table-definition';
import { createTableRegistry } from '../shared/table-registry';
import { createInMemorySyncEngine } from './in-memory-sync-engine';

function waitForHydrated(sub: {
  getHydrated: () => boolean;
  subscribe: (listener: () => void) => () => void;
}): Promise<void> {
  if (sub.getHydrated()) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const unsub = sub.subscribe(() => {
      if (sub.getHydrated()) {
        unsub();
        resolve();
      }
    });
  });
}

describe('createInMemorySyncEngine', () => {
  test('watch query is not hydrated until first refresh completes', () => {
    const registry = createTableRegistry([
      defineTable({
        tableName: 'profiles',
        columns: [
          { name: 'id', type: 'text', primaryKey: true },
          { name: 'display_name', type: 'text' },
        ],
      }),
    ]);
    const engine = createInMemorySyncEngine({ registry });
    const sub = engine.watch<{ id: string }>(
      honey({ select: ['id'], from: 'profiles', where: 0 })
    );
    expect(sub.getSnapshot()).toEqual([]);
    expect(sub.getHydrated()).toBe(false);
  });

  test('watch query returns rows after connect without polling', async () => {
    const registry = createTableRegistry([
      defineTable({
        tableName: 'profiles',
        columns: [
          { name: 'id', type: 'text', primaryKey: true },
          { name: 'display_name', type: 'text' },
        ],
      }),
    ]);
    const engine = createInMemorySyncEngine({ registry });
    await engine.connect();
    await engine.db.run(
      honey({
        insertInto: 'profiles',
        values: { id: 'p1', display_name: 'Ada' },
      })
    );

    const sub = engine.watch<{ id: string; display_name: string }>(
      honey({
        select: ['id', 'display_name'],
        from: 'profiles',
        where: ['=', 'id', 'p1'],
      })
    );
    await waitForHydrated(sub);
    expect(sub.getHydrated()).toBe(true);
    expect(sub.getSnapshot()[0]?.display_name).toBe('Ada');
    await engine.disconnect();
  });

  test('watch refreshes on write without timers', async () => {
    const registry = createTableRegistry([
      defineTable({
        tableName: 'profiles',
        columns: [
          { name: 'id', type: 'text', primaryKey: true },
          { name: 'display_name', type: 'text' },
        ],
      }),
    ]);
    const engine = createInMemorySyncEngine({ registry });
    await engine.connect();
    await engine.db.run(
      honey({
        insertInto: 'profiles',
        values: { id: 'p1', display_name: 'Ada' },
      })
    );

    const sub = engine.watch<{ display_name: string }>(
      honey({
        select: ['display_name'],
        from: 'profiles',
        where: ['=', 'id', 'p1'],
      })
    );
    await waitForHydrated(sub);

    const next = new Promise<string>((resolve) => {
      const unsub = sub.subscribe(() => {
        const name = sub.getSnapshot()[0]?.display_name;
        if (name === 'Grace') {
          unsub();
          resolve(name);
        }
      });
    });

    await engine.db.run(
      honey({
        update: 'profiles',
        set: { display_name: 'Grace' },
        where: ['=', 'id', 'p1'],
      })
    );
    expect(await next).toBe('Grace');
  });

  test('hasEverSynced latches true and persists through reconnect', async () => {
    const registry = createTableRegistry([
      defineTable({
        tableName: 'profiles',
        columns: [{ name: 'id', type: 'text', primaryKey: true }],
      }),
    ]);
    const engine = createInMemorySyncEngine({ registry });

    expect(engine.status.getSnapshot().hasEverSynced).toBe(false);

    await engine.connect();
    expect(engine.status.getSnapshot().hasSynced).toBe(true);
    expect(engine.status.getSnapshot().hasEverSynced).toBe(true);

    await engine.disconnect();
    expect(engine.status.getSnapshot().hasSynced).toBe(false);
    expect(engine.status.getSnapshot().hasEverSynced).toBe(true);
  });

  test('clearLocalData resets hasEverSynced', async () => {
    const registry = createTableRegistry([
      defineTable({
        tableName: 'profiles',
        columns: [{ name: 'id', type: 'text', primaryKey: true }],
      }),
    ]);
    const engine = createInMemorySyncEngine({ registry });
    await engine.connect();
    expect(engine.status.getSnapshot().hasEverSynced).toBe(true);

    await engine.clearLocalData();
    expect(engine.status.getSnapshot().hasEverSynced).toBe(false);
    expect(engine.status.getSnapshot().hasSynced).toBe(false);
  });
});
