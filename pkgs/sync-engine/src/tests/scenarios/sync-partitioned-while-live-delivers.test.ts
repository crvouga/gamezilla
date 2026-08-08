import { describe, test } from 'bun:test';
import {
  expectLiveNote,
  expectNotesMatchServer,
  notesDomainPack,
  setNote,
} from '../../domain-packs/notes-app';
import { RELIABLE_FAULTS } from '../../sim/faults';
import { openSimWorld } from '../../sim/world';

describe('sync partitioned while live delivers', () => {
  test('partition sync then heal converges', async () => {
    const world = await openSimWorld({
      domain: notesDomainPack,
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
