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

describe('soft delete tombstone propagates and revives', () => {
  test('delete tombstones on peer after converge', async () => {
    const world = await openSimWorld({
      domain: notesDomainPack,
      seed: 13,
      faults: RELIABLE_FAULTS,
    });
    try {
      const a = await world.addClient({ id: 'alice' });
      const b = await world.addClient({ id: 'bob' });

      await a.mutate(setNote, { id: 'n1', body: 'x' });
      await world.assertConverged();

      const del = await a.mutate(deleteNote, { id: 'n1' });
      expect(del.ok).toBe(true);
      await world.assertConverged();

      await expectNoteNotLive(b.db, 'n1');
      const tomb = await readNoteTombstone(b.db, 'n1');
      expect(tomb).not.toBeNull();
    } finally {
      await world.dispose();
    }
  });

  test('setNote after delete revives the row', async () => {
    const world = await openSimWorld({
      domain: notesDomainPack,
      seed: 14,
      faults: RELIABLE_FAULTS,
    });
    try {
      const a = await world.addClient({ id: 'alice' });
      const b = await world.addClient({ id: 'bob' });

      await a.mutate(setNote, { id: 'n1', body: 'first' });
      await world.assertConverged();
      await a.mutate(deleteNote, { id: 'n1' });
      await world.assertConverged();
      await expectNoteNotLive(b.db, 'n1');

      await a.mutate(setNote, { id: 'n1', body: 'revived' });
      await world.assertConverged();
      await expectLiveNote(b.db, 'n1', { body: 'revived' });
      expect(await readNoteTombstone(b.db, 'n1')).toBeNull();
    } finally {
      await world.dispose();
    }
  });
});
