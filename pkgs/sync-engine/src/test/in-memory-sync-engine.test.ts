import { describe, expect, test } from 'bun:test';

import { defineTable } from '../shared/table-definition';
import { createTableRegistry } from '../shared/table-registry';
import { createInMemorySyncEngine } from './in-memory-sync-engine';

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
    const sub = engine.watch<{ id: string }>('SELECT id FROM profiles WHERE 0');
    expect(sub.getSnapshot()).toEqual([]);
    expect(sub.getHydrated()).toBe(false);
  });

  test('watch query returns rows after connect', async () => {
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
      'INSERT INTO profiles (id, display_name) VALUES (?, ?)',
      ['p1', 'Ada']
    );

    const sub = engine.watch<{ id: string; display_name: string }>(
      'SELECT id, display_name FROM profiles WHERE id = ?',
      ['p1']
    );
    await new Promise((r) => setTimeout(r, 150));
    expect(sub.getHydrated()).toBe(true);
    expect(sub.getSnapshot()[0]?.display_name).toBe('Ada');
    await engine.disconnect();
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
