import { describe, expect, test } from 'bun:test';
import {
  expectLiveNote,
  expectNotesMatchServer,
  notesDomainPack,
  readLiveNotes,
  setNote,
} from '../../domain-packs/notes-app';
import { RELIABLE_FAULTS } from '../../sim/faults';
import { openSimWorld } from '../../sim/world';

describe('crash mid merge restart rehydrates', () => {
  test('crash after sync delivery; restart never torn across tables', async () => {
    const world = await openSimWorld({
      domain: notesDomainPack,
      seed: 830,
      faults: RELIABLE_FAULTS,
      // Force sync refetch path so afterNextSyncResponseDelivered fires.
      rowImageFanout: false,
    });
    try {
      const a = await world.addClient({ id: 'alice' });
      await world.addClient({ id: 'bob' });

      await a.mutate(setNote, { id: 'n1', body: 'one' });
      await a.mutate(setNote, { id: 'n2', body: 'two' });
      await world.assertConverged();

      world.armCrash('bob', 'afterNextSyncResponseDelivered');
      await a.mutate(setNote, { id: 'n1', body: 'updated' });
      await a.mutate(setNote, { id: 'n3', body: 'three' });
      await world.runFor(800);

      expect(world.clients.has('bob')).toBe(false);
      const bob = await world.restartClient('bob', { preserveLocalDb: true });
      await world.assertConverged();

      const notes = await readLiveNotes(bob.db);
      const ids = new Set(notes.map((n) => n.id));
      expect(ids.has('n1')).toBe(true);
      expect(ids.has('n2')).toBe(true);
      await expectLiveNote(bob.db, 'n1', { body: 'updated' });
      await expectLiveNote(bob.db, 'n3', { body: 'three' });
      await expectNotesMatchServer(bob.db, world.server.db);
    } finally {
      await world.dispose();
    }
  });
});
