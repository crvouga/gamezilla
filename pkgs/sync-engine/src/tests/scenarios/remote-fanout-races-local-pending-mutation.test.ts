import { describe, test } from 'bun:test';

import { RELIABLE_FAULTS } from '../../sim/faults';
import { setNote } from '../../sim/notes-app';
import { openSimWorld } from '../../sim/world';

describe('remote fanout races local pending mutation', () => {
  test('fanout races local pending mutation on same row then converges', async () => {
    const world = await openSimWorld({ seed: 29, faults: RELIABLE_FAULTS });
    try {
      const a = await world.addClient({ id: 'alice' });
      const b = await world.addClient({ id: 'bob' });

      await a.mutate(setNote, { id: 'n1', body: 'from-a' });
      await world.assertConverged();

      b.lifecycle.setOnline(false);
      await b.mutate(setNote, { id: 'n1', body: 'from-b-pending' });
      b.lifecycle.setOnline(true);
      await a.mutate(setNote, { id: 'n1', body: 'from-a-2' });
      await world.runFor(500);
      await world.assertConverged();
    } finally {
      await world.dispose();
    }
  });
});
