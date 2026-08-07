import { describe, expect, test } from 'bun:test';

import { defineSchema } from '@pkgs/db-schema';
import { sql } from '@pkgs/sql';

import { createInMemorySyncEngine } from './in-memory-sync-engine';

const profilesSchema = defineSchema({
  tables: {
    profiles: {
      id: 'text',
      display_name: 'text',
    },
  },
  uniqueIndexes: [['profiles', 'id']],
});

const PROFILES_SCHEMA = {
  domainSchema: profilesSchema,
  cacheTableNames: ['profiles'],
} as const;

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
  test('watch query is not hydrated until first refresh completes', async () => {
    const engine = await createInMemorySyncEngine({ schema: PROFILES_SCHEMA });
    const sub = engine.watch(
      sql<{ id: string }>`SELECT id FROM profiles WHERE false`
    );
    expect(sub.getSnapshot()).toEqual([]);
    expect(sub.getHydrated()).toBe(false);
  });

  test('watch query returns rows after connect without polling', async () => {
    const engine = await createInMemorySyncEngine({ schema: PROFILES_SCHEMA });
    await engine.connect();
    await engine.db.run(
      sql<void>`
        INSERT INTO profiles (id, display_name)
        VALUES (${'p1'}, ${'Ada'})`
    );

    const sub = engine.watch(sql<{ id: string; display_name: string }>`
        SELECT id, display_name
          FROM profiles
         WHERE id = ${'p1'}`);
    await waitForHydrated(sub);
    expect(sub.getHydrated()).toBe(true);
    expect(sub.getSnapshot()[0]?.display_name).toBe('Ada');
    await engine.disconnect();
  });

  test('watch refreshes on write without timers', async () => {
    const engine = await createInMemorySyncEngine({ schema: PROFILES_SCHEMA });
    await engine.connect();
    await engine.db.run(
      sql<void>`
        INSERT INTO profiles (id, display_name)
        VALUES (${'p1'}, ${'Ada'})`
    );

    const sub = engine.watch(sql<{ display_name: string }>`
        SELECT display_name
          FROM profiles
         WHERE id = ${'p1'}`);
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
      sql<void>`
        UPDATE profiles
           SET display_name = ${'Grace'}
         WHERE id = ${'p1'}`
    );
    expect(await next).toBe('Grace');
  });

  test('hasEverSynced latches true and persists through reconnect', async () => {
    const engine = await createInMemorySyncEngine({ schema: PROFILES_SCHEMA });

    expect(engine.status.getSnapshot().hasEverSynced).toBe(false);

    await engine.connect();
    expect(engine.status.getSnapshot().hasSynced).toBe(true);
    expect(engine.status.getSnapshot().hasEverSynced).toBe(true);

    await engine.disconnect();
    expect(engine.status.getSnapshot().hasSynced).toBe(false);
    expect(engine.status.getSnapshot().hasEverSynced).toBe(true);
  });

  test('clearLocalData resets hasEverSynced', async () => {
    const engine = await createInMemorySyncEngine({ schema: PROFILES_SCHEMA });
    await engine.connect();
    expect(engine.status.getSnapshot().hasEverSynced).toBe(true);

    await engine.clearLocalData();
    expect(engine.status.getSnapshot().hasEverSynced).toBe(false);
    expect(engine.status.getSnapshot().hasSynced).toBe(false);
  });
});
