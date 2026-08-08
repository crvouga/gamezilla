import { describe, test } from 'bun:test';
import {
  expectLiveNote,
  expectNotesMatchServer,
  notesDomainPack,
  setNote,
} from '../../domain-packs/notes-app';
import { RELIABLE_FAULTS } from '../../sim/faults';
import { openSimWorld } from '../../sim/world';

describe('content reverts hash matches not modified sound', () => {
  test('A→B→A while peer partitioned leaves peer at A after heal', async () => {
    const world = await openSimWorld({
      domain: notesDomainPack,
      seed: 803,
      faults: RELIABLE_FAULTS,
    });
    try {
      const a = await world.addClient({ id: 'alice' });
      const b = await world.addClient({ id: 'bob' });

      await a.mutate(setNote, { id: 'n1', body: 'A' });
      await world.assertConverged();
      await expectLiveNote(b.db, 'n1', { body: 'A' });

      // Full partition so peer never applies intermediate B via live images.
      world.partition('bob');
      await a.mutate(setNote, { id: 'n1', body: 'B' });
      await a.mutate(setNote, { id: 'n1', body: 'A' });
      await world.runFor(100);
      await expectLiveNote(b.db, 'n1', { body: 'A' });

      world.heal('bob');
      // Fire-and-forget: drain runs on the virtual clock via assertConverged.
      void b.engine.refreshQueries();
      await world.assertConverged();

      await expectLiveNote(b.db, 'n1', { body: 'A' });
      await expectLiveNote(a.db, 'n1', { body: 'A' });
      await expectNotesMatchServer(b.db, world.server.db);
    } finally {
      await world.dispose();
    }
  });
});
