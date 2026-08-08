import { describe, expect, test } from 'bun:test';
import {
  notesDomainPack,
  readLiveNotes,
  setNote,
} from '../../domain-packs/notes-app';
import { openSimWorld } from '../../sim/world';

describe('two offline same id single winner', () => {
  test('two clients offline conflict then converge to one winner', async () => {
    const world = await openSimWorld({ domain: notesDomainPack, seed: 7 });
    try {
      const a = await world.addClient({ id: 'alice' });
      const b = await world.addClient({ id: 'bob' });
      await world.runFor(100);

      a.lifecycle.setOnline(false);
      b.lifecycle.setOnline(false);
      await a.mutate(setNote, { id: 'shared', body: 'from-a' });
      await b.mutate(setNote, { id: 'shared', body: 'from-b' });

      a.lifecycle.setOnline(true);
      b.lifecycle.setOnline(true);
      await world.assertConverged();

      const server = await readLiveNotes(world.server.db);
      const winner = server.find((r) => r.id === 'shared');
      expect(winner).toBeDefined();
      expect(winner?.body === 'from-a' || winner?.body === 'from-b').toBe(true);

      const localA = await readLiveNotes(a.db);
      const localB = await readLiveNotes(b.db);
      expect(localA.find((r) => r.id === 'shared')?.body).toBe(winner?.body);
      expect(localB.find((r) => r.id === 'shared')?.body).toBe(winner?.body);
    } finally {
      await world.dispose();
    }
  });
});
