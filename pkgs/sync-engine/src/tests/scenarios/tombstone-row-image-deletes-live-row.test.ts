import { describe, expect, test } from 'bun:test';
import {
  deleteNote,
  expectLiveNote,
  expectNoteNotLive,
  notesDomainPack,
  readNoteTombstone,
  setNote,
} from '../../domain-packs/notes-app';
import { RELIABLE_FAULTS } from '../../sim/faults';
import { openSimWorld } from '../../sim/world';

describe('tombstone row image deletes live row', () => {
  test('delete row image removes live peer row without waiting on sync', async () => {
    const world = await openSimWorld({
      domain: notesDomainPack,
      seed: 806,
      faults: RELIABLE_FAULTS,
    });
    try {
      const a = await world.addClient({ id: 'alice' });
      const b = await world.addClient({ id: 'bob' });

      await a.mutate(setNote, { id: 'n1', body: 'alive' });
      await world.assertConverged();
      await expectLiveNote(b.db, 'n1', { body: 'alive' });

      world.hold('bob', 'sync');
      const del = await a.mutate(deleteNote, { id: 'n1' });
      expect(del.ok).toBe(true);
      await world.runFor(300);

      await expectNoteNotLive(b.db, 'n1');
      expect(await readNoteTombstone(b.db, 'n1')).not.toBeNull();

      world.release('bob', 'sync');
      await world.assertConverged();
      await expectNoteNotLive(b.db, 'n1');
    } finally {
      await world.dispose();
    }
  });
});
