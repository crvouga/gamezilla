import { describe, test } from 'bun:test';

import { RELIABLE_FAULTS } from '../../sim/faults';
import { expectLiveNote, setNote } from '../../sim/notes-app';
import { openSimWorld } from '../../sim/world';

describe('crash restart', () => {
  test('offline queue drains after reconnect', async () => {
    const world = await openSimWorld({ seed: 40, faults: RELIABLE_FAULTS });
    try {
      const a = await world.addClient({ id: 'alice' });
      const b = await world.addClient({ id: 'bob' });

      a.lifecycle.setOnline(false);
      await a.mutate(setNote, { id: 'n1', body: 'queued' });
      await world.runFor(50);

      a.lifecycle.setOnline(true);
      await world.assertConverged();
      await expectLiveNote(b.db, 'n1', { body: 'queued' });
    } finally {
      await world.dispose();
    }
  });

  test('restart after crash rehydrates all live notes', async () => {
    const world = await openSimWorld({ seed: 41, faults: RELIABLE_FAULTS });
    try {
      const a = await world.addClient({ id: 'alice' });
      await world.addClient({ id: 'bob' });
      await a.mutate(setNote, { id: 'n1', body: 'one' });
      await a.mutate(setNote, { id: 'n2', body: 'two' });
      await world.assertConverged();

      await world.crashClient('bob');
      const bob = await world.restartClient('bob');
      await world.assertConverged();
      await expectLiveNote(bob.db, 'n1', { body: 'one' });
      await expectLiveNote(bob.db, 'n2', { body: 'two' });
    } finally {
      await world.dispose();
    }
  });
});
