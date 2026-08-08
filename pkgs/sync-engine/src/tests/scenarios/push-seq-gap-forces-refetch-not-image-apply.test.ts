import { describe, test } from 'bun:test';

import { RELIABLE_FAULTS } from '../../sim/faults';
import {
  expectLiveNote,
  expectNotesMatchServer,
  setNote,
} from '../../sim/notes-app';
import { openSimWorld } from '../../sim/world';

describe('push seq gap forces refetch not image apply', () => {
  test('lost live push creates gap; later push still converges via refetch', async () => {
    const world = await openSimWorld({ seed: 804, faults: RELIABLE_FAULTS });
    try {
      const a = await world.addClient({ id: 'alice' });
      const b = await world.addClient({ id: 'bob' });

      await a.mutate(setNote, { id: 'warm', body: 'w' });
      await world.assertConverged();

      // Drop the next live fanout (gap), keep sync so repair can refetch.
      world.setFaults('bob', 'live', { packetLossProbability: 1 });
      await a.mutate(setNote, { id: 'n1', body: 'lost-push' });
      await world.runFor(80);
      world.clearFaults('bob');

      // Contiguous-looking later push must not image-apply across the gap.
      world.hold('bob', 'sync');
      await a.mutate(setNote, { id: 'n2', body: 'after-gap' });
      await world.runFor(200);
      world.release('bob', 'sync');
      await world.assertConverged();

      await expectLiveNote(b.db, 'n1', { body: 'lost-push' });
      await expectLiveNote(b.db, 'n2', { body: 'after-gap' });
      await expectNotesMatchServer(b.db, world.server.db);
    } finally {
      await world.dispose();
    }
  });
});
