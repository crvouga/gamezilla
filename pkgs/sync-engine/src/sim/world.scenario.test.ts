import { describe, expect, test } from 'bun:test';
import { sql } from '@pkgs/sql';

import { simSetNote } from './profile';
import { runSeed } from './replay';
import { openSimWorld } from './world';

describe('sim world scenarios', () => {
  test('single client mutate uploads and merges', async () => {
    const world = await openSimWorld({ seed: 1 });
    try {
      const a = await world.addClient({ id: 'alice' });
      const result = await a.mutate(simSetNote, { id: 'n1', body: 'hello' });
      expect(result.ok).toBe(true);
      await world.assertConverged();
      const rows = await a.db.query(sql<{ body: string }>`
        SELECT body FROM notes WHERE id = ${'n1'}
      `);
      expect(rows[0]?.body).toBe('hello');
    } finally {
      await world.dispose();
    }
  });

  test('two clients offline conflict then converge', async () => {
    const world = await openSimWorld({ seed: 7 });
    try {
      const a = await world.addClient({ id: 'alice' });
      const b = await world.addClient({ id: 'bob' });
      await world.runFor(100);

      a.lifecycle.setOnline(false);
      b.lifecycle.setOnline(false);
      await a.mutate(simSetNote, { id: 'shared', body: 'from-a' });
      await b.mutate(simSetNote, { id: 'shared', body: 'from-b' });

      a.lifecycle.setOnline(true);
      b.lifecycle.setOnline(true);
      await world.assertConverged();

      const server = await world.server.db.query(sql<{ body: string }>`
        SELECT body FROM notes WHERE id = ${'shared'}
      `);
      expect(server[0]?.body === 'from-a' || server[0]?.body === 'from-b').toBe(
        true
      );
      const localA = await a.db.query(sql<{ body: string }>`
        SELECT body FROM notes WHERE id = ${'shared'}
      `);
      const localB = await b.db.query(sql<{ body: string }>`
        SELECT body FROM notes WHERE id = ${'shared'}
      `);
      expect(localA[0]?.body).toBe(server[0]?.body);
      expect(localB[0]?.body).toBe(server[0]?.body);
    } finally {
      await world.dispose();
    }
  });

  test('same seed runSeed is deterministic', async () => {
    const first = await runSeed({ seed: 123, steps: 12, clientCount: 2 });
    const second = await runSeed({ seed: 123, steps: 12, clientCount: 2 });
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(first).toEqual(second);
  });
});
