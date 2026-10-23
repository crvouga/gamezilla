import { describe, expect, test } from 'bun:test';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { createInMemorySyncEngine } from '@pkgs/sync-engine-harness-ts/in-memory-sync-engine';
import { exampleLocalSchema } from '@pkgs/sync-engine-harness-ts/local-schema';

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

describe('public API: createInMemorySyncEngine watch', () => {
  test('watch reacts to local domain INSERT', async () => {
    const engine = await createInMemorySyncEngine({
      schema: exampleLocalSchema,
    });
    await engine.connect();

    const sub = engine.watch(sql<{ id: string; body: string }>`
      SELECT id, body FROM notes
      WHERE deleted_at IS NULL
      ORDER BY id ASC
    `);
    await waitForHydrated(sub);
    expect(sub.getSnapshot()).toEqual([]);

    const next = new Promise<string>((resolve) => {
      const unsub = sub.subscribe(() => {
        const body = sub.getSnapshot()[0]?.body;
        if (body === 'watched') {
          unsub();
          resolve(body);
        }
      });
    });

    await engine.db.run(sql`
      INSERT INTO notes (
        id, folder_id, title, body, owner_id, created_at, updated_at
      )
      VALUES (
        ${'n1'},
        ${null},
        ${''},
        ${'watched'},
        ${'alice'},
        ${'2020-01-01T00:00:00.000Z'},
        ${'2020-01-01T00:00:00.000Z'}
      )
    `);
    expect(await next).toBe('watched');
    await engine.disconnect();
  });
});
