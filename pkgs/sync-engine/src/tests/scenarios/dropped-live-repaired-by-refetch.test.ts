import { describe, test } from 'bun:test';
import {
  expectLiveNote,
  notesDomainPack,
  setNote,
} from '../../domain-packs/notes-app';
import { RELIABLE_FAULTS } from '../../sim/faults';
import { openSimWorld } from '../../sim/world';

describe('dropped live repaired by refetch', () => {
  test('dropped fanout converges via refetch after heal', async () => {
    await using world = await openSimWorld({
      domain: notesDomainPack,
      seed: 11,
      faults: RELIABLE_FAULTS,
    });
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });

    {
      using _loss = world.net('bob', 'live').set({ packetLossProbability: 1 });
      await a.mutate(setNote, { id: 'n1', body: 'lost' });
      await world.runFor(50);
    }
    await world.assertConverged();

    await expectLiveNote(b.db, 'n1', { body: 'lost' });
  });

  test('reorder window still converges', async () => {
    await using world = await openSimWorld({
      domain: notesDomainPack,
      seed: 12,
      faults: {
        ...RELIABLE_FAULTS,
        oneWayDelayMeanMs: 20,
        oneWayDelayJitterMs: 40,
        reorderWindow: 5,
      },
    });
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });
    await a.mutate(setNote, { id: 'n1', body: 'a' });
    await a.mutate(setNote, { id: 'n2', body: 'b' });
    await a.mutate(setNote, { id: 'n3', body: 'c' });
    await world.assertConverged();
    await expectLiveNote(b.db, 'n2', { body: 'b' });
  });

  test('duplicate delivery still converges', async () => {
    await using world = await openSimWorld({
      domain: notesDomainPack,
      seed: 15,
      faults: {
        ...RELIABLE_FAULTS,
        packetReplayProbability: 0.8,
      },
    });
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });
    await a.mutate(setNote, { id: 'n1', body: 'dup' });
    await world.assertConverged();
    await expectLiveNote(b.db, 'n1', { body: 'dup' });
  });
});
