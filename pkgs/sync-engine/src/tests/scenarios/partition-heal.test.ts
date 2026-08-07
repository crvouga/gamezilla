import { describe, test } from 'bun:test';

import { RELIABLE_FAULTS } from '../../sim/faults';
import { expectLiveNote, setNote } from '../../sim/notes-app';
import { openSimWorld } from '../../sim/world';

describe('partition heal', () => {
  test('partition then heal converges domain state', async () => {
    const world = await openSimWorld({ seed: 33, faults: RELIABLE_FAULTS });
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
