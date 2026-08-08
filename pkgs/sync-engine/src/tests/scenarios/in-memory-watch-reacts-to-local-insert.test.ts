import { describe, expect, test } from 'bun:test';
import { sql } from '@pkgs/sql';
import { notesLocalSchema } from '../../sim/notes-app';
import { createInMemorySyncEngine } from '../../test/in-memory-sync-engine';

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

describe('in memory watch reacts to local insert', () => {
  test('in-memory engine watch reflects domain writes', async () => {
    const engine = await createInMemorySyncEngine({
      schema: notesLocalSchema,
    });
    await engine.connect();

    const sub = engine.watch(sql<{ id: string; body: string }>`
      SELECT id, body FROM notes
      WHERE _deleted_at IS NULL
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
      INSERT INTO notes (id, folder_id, title, body, owner_id)
      VALUES (${'n1'}, ${null}, ${''}, ${'watched'}, ${'alice'})
    `);
    expect(await next).toBe('watched');
    await engine.disconnect();
  });
});
