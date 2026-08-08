import { describe, expect, test } from 'bun:test';
import {
  deleteNote,
  expectLiveNote,
  expectNoteNotLive,
  notesDomainPack,
  readNoteTombstone,
  setNote,
} from '../../domain-packs/notes-app';
import { openSimWorld } from '../../sim/world';

describe('tombstone row image deletes live row', () => {
  test('delete row image removes live peer row without waiting on sync', async () => {
    await using world = await openSimWorld({
      domain: notesDomainPack,
      seed: 806,
    });
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });

    await a.mutate(setNote, { id: 'n1', body: 'alive' });
    await world.assertConverged();
    await expectLiveNote(b.db, 'n1', { body: 'alive' });

    {
      using _hold = world.net('bob', 'sync').set('hold');
      const del = await a.mutate(deleteNote, { id: 'n1' });
      expect(del.ok).toBe(true);
      await world.runFor(300);

      await expectNoteNotLive(b.db, 'n1');
      expect(await readNoteTombstone(b.db, 'n1')).not.toBeNull();
    }
    await world.assertConverged();
    await expectNoteNotLive(b.db, 'n1');
  });
});
