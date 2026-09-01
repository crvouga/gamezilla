import { describe, test } from 'bun:test';
import { openWorld } from '@pkgs/determinism';
import { RELIABLE_FAULTS } from '../../sim/faults';
import { toKernelFaults } from '../../sim/network';
import { expectLiveNote, setNote } from '../apps/acme';
import { acmeSystem } from '../apps/acme/system';

describe('dropped live repaired by refetch', () => {
  test('dropped fanout converges via refetch after heal', async () => {
    await using host = await openWorld(acmeSystem, {
      seed: 11,
      knobs: {
        clientCount: 0,
      },
    });
    const world = host.facade;
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
    await using host = await openWorld(acmeSystem, {
      seed: 12,
      knobs: {
        clientCount: 0,
      },
      networkDefaults: toKernelFaults({
        ...RELIABLE_FAULTS,
        oneWayDelayMeanMs: 20,
        oneWayDelayJitterMs: 40,
        reorderWindow: 5,
      }),
    });
    const world = host.facade;
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });
    await a.mutate(setNote, { id: 'n1', body: 'a' });
    await a.mutate(setNote, { id: 'n2', body: 'b' });
    await a.mutate(setNote, { id: 'n3', body: 'c' });
    await world.assertConverged();
    await expectLiveNote(b.db, 'n2', { body: 'b' });
  });

  test('duplicate delivery still converges', async () => {
    await using host = await openWorld(acmeSystem, {
      seed: 15,
      knobs: {
        clientCount: 0,
      },
      networkDefaults: toKernelFaults({
        ...RELIABLE_FAULTS,
        packetReplayProbability: 0.8,
      }),
    });
    const world = host.facade;
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });
    await a.mutate(setNote, { id: 'n1', body: 'dup' });
    await world.assertConverged();
    await expectLiveNote(b.db, 'n1', { body: 'dup' });
  });
});
