import { describe, test } from 'bun:test';

import { RELIABLE_FAULTS } from '../../sim/faults';
import { expectLiveNote, setNote } from '../../sim/notes-app';
import { openSimWorld } from '../../sim/world';

describe('network faults', () => {
  test('dropped fanout converges via refetch after heal', async () => {
    const world = await openSimWorld({ seed: 11, faults: RELIABLE_FAULTS });
    try {
      const a = await world.addClient({ id: 'alice' });
      const b = await world.addClient({ id: 'bob' });

      world.setFaults('bob', 'live', { packetLossProbability: 1 });
      await a.mutate(setNote, { id: 'n1', body: 'lost' });
      await world.runFor(50);
      world.clearFaults('bob');
      world.healAll();
      await world.assertConverged();

      await expectLiveNote(b.db, 'n1', { body: 'lost' });
    } finally {
      await world.dispose();
    }
  });

  test('reorder window still converges', async () => {
    const world = await openSimWorld({
      seed: 12,
      faults: {
        ...RELIABLE_FAULTS,
        oneWayDelayMeanMs: 20,
        oneWayDelayJitterMs: 40,
        reorderWindow: 5,
      },
    });
    try {
      const a = await world.addClient({ id: 'alice' });
      const b = await world.addClient({ id: 'bob' });
      await a.mutate(setNote, { id: 'n1', body: 'a' });
      await a.mutate(setNote, { id: 'n2', body: 'b' });
      await a.mutate(setNote, { id: 'n3', body: 'c' });
      await world.assertConverged();
      await expectLiveNote(b.db, 'n2', { body: 'b' });
    } finally {
      await world.dispose();
    }
  });

  test('duplicate delivery still converges', async () => {
    const world = await openSimWorld({
      seed: 15,
      faults: {
        ...RELIABLE_FAULTS,
        packetReplayProbability: 0.8,
      },
    });
    try {
      const a = await world.addClient({ id: 'alice' });
      const b = await world.addClient({ id: 'bob' });
      await a.mutate(setNote, { id: 'n1', body: 'dup' });
      await world.assertConverged();
      await expectLiveNote(b.db, 'n1', { body: 'dup' });
    } finally {
      await world.dispose();
    }
  });
});
