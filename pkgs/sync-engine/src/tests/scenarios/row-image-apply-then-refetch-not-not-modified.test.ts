import { describe, test } from 'bun:test';

import { RELIABLE_FAULTS } from '../../sim/faults';
import {
  expectLiveNote,
  expectNotesMatchServer,
  setNote,
} from '../../sim/notes-app';
import { openSimWorld } from '../../sim/world';

describe('row image apply then refetch not not modified', () => {
  test('live row-image paint while sync held still converges after refetch', async () => {
    // Row images must not advance content hash; release+refetch stays sound.
    const world = await openSimWorld({ seed: 801, faults: RELIABLE_FAULTS });
    try {
      const a = await world.addClient({ id: 'alice' });
      const b = await world.addClient({ id: 'bob' });

      await a.mutate(setNote, { id: 'n1', body: 'seed' });
      await a.mutate(setNote, { id: 'n2', body: 'other' });
      await world.assertConverged();

      world.hold('bob', 'sync');
      await a.mutate(setNote, { id: 'n1', body: 'via-image' });
      await world.runFor(300);
      await expectLiveNote(b.db, 'n1', { body: 'via-image' });
      await expectLiveNote(b.db, 'n2', { body: 'other' });

      world.release('bob', 'sync');
      // Fire-and-forget: drain runs on the virtual clock via assertConverged.
      void b.engine.refreshQueries();
      await world.assertConverged();
      await expectLiveNote(b.db, 'n1', { body: 'via-image' });
      await expectNotesMatchServer(b.db, world.server.db);
    } finally {
      await world.dispose();
    }
  });
});
