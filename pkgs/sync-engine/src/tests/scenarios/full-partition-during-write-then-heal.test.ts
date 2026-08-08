import { describe, test } from 'bun:test';
import {
  expectLiveNote,
  notesDomainPack,
  setNote,
} from '../../domain-packs/notes-app';
import { RELIABLE_FAULTS } from '../../sim/faults';
import { openSimWorld } from '../../sim/world';

describe('full partition during write then heal', () => {
  test('partition then heal converges domain state', async () => {
    const world = await openSimWorld({
      domain: notesDomainPack,
      seed: 33,
      faults: RELIABLE_FAULTS,
    });
    try {
      const a = await world.addClient({ id: 'alice' });
      const b = await world.addClient({ id: 'bob' });
      await a.mutate(setNote, { id: 'warm', body: 'w' });
      await world.assertConverged();

      world.partition('alice');
      world.partition('bob');
      await a.mutate(setNote, { id: 'n1', body: 'during-partition' });
      await world.runFor(100);
      world.healAll();
      await world.assertConverged();

      await expectLiveNote(b.db, 'n1', { body: 'during-partition' });
    } finally {
      await world.dispose();
    }
  });
});
