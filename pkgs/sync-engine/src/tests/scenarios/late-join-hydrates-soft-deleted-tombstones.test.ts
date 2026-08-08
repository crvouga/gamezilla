import { describe, expect, test } from 'bun:test';

import { RELIABLE_FAULTS } from '../../sim/faults';
import {
  deleteNote,
  expectNoteNotLive,
  readNoteTombstone,
  setNote,
} from '../../sim/notes-app';
import { openSimWorld } from '../../sim/world';

describe('late join hydrates soft deleted tombstones', () => {
  test('peer that joins after delete gets tombstone from snapshot', async () => {
    const world = await openSimWorld({ seed: 511, faults: RELIABLE_FAULTS });
    try {
      const a = await world.addClient({ id: 'alice' });
      await a.mutate(setNote, { id: 'n1', body: 'gone' });
      await world.assertConverged();
      await a.mutate(deleteNote, { id: 'n1' });
      await world.assertConverged();

      const c = await world.addClient({ id: 'charlie' });
      await expectNoteNotLive(c.db, 'n1');
      const tomb = await readNoteTombstone(c.db, 'n1');
      expect(tomb).not.toBeNull();
    } finally {
      await world.dispose();
    }
  });
});
