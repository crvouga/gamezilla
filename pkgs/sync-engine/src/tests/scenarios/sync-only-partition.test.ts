import { describe, test } from 'bun:test';

import { RELIABLE_FAULTS } from '../../sim/faults';
import {
  expectLiveNote,
  expectNotesMatchServer,
  setNote,
} from '../../sim/notes-app';
import { openSimWorld } from '../../sim/world';

describe('sync-only partition', () => {
  test('partition sync then heal converges', async () => {
    const world = await openSimWorld({
      seed: 506,
      faults: RELIABLE_FAULTS,
      rowImageFanout: false,
    });
    try {
      const a = await world.addClient({ id: 'alice' });
      const b = await world.addClient({ id: 'bob' });
      await a.mutate(setNote, { id: 'warm', body: 'w' });
      await world.assertConverged();

      world.partition('bob', 'sync');
      await a.mutate(setNote, { id: 'n1', body: 'sync-partitioned' });
      await world.runFor(100);
      world.heal('bob');
      await world.assertConverged();
      await expectLiveNote(b.db, 'n1', { body: 'sync-partitioned' });
      await expectNotesMatchServer(b.db, world.server.db);
    } finally {
      await world.dispose();
    }
  });
});
