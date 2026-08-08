import { describe, test } from 'bun:test';

import { RELIABLE_FAULTS } from '../../sim/faults';
import {
  expectLiveNote,
  expectNotesMatchServer,
  setNote,
} from '../../sim/notes-app';
import { openSimWorld } from '../../sim/world';

describe('reordered http responses stale checkpoint dropped', () => {
  test('reordered sync responses never regress newer domain rows', async () => {
    const world = await openSimWorld({ seed: 802, faults: RELIABLE_FAULTS });
    try {
      const a = await world.addClient({ id: 'alice' });
      const b = await world.addClient({ id: 'bob' });
      await a.mutate(setNote, { id: 'warm', body: 'w' });
      await world.assertConverged();

      world.setFaults('bob', 'sync', {
        oneWayDelayMeanMs: 20,
        oneWayDelayJitterMs: 40,
        reorderWindow: 6,
      });

      await a.mutate(setNote, { id: 'n1', body: 'v1' });
      await a.mutate(setNote, { id: 'n1', body: 'v2' });
      await a.mutate(setNote, { id: 'n1', body: 'v3-final' });
      await a.mutate(setNote, { id: 'n2', body: 'side' });
      await world.assertConverged();

      await expectLiveNote(b.db, 'n1', { body: 'v3-final' });
      await expectLiveNote(b.db, 'n2', { body: 'side' });
      await expectNotesMatchServer(b.db, world.server.db);
    } finally {
      await world.dispose();
    }
  });
});
