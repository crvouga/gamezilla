import { describe, expect, test } from 'bun:test';
import { openWorld } from '@pkgs/determinism';
import { toKernelFaults } from '../../sim/network';
import { syncFacade } from '../../sim/system';
import { expectLiveNote, readLiveNotes, setNote } from '../apps/acme';
import { acmeSystem } from '../apps/acme/system';

describe('delayed sync after ack no optimistic flicker', () => {
  test('optimistic body never reverts under delayed sync after upload ack', async () => {
    await using host = await openWorld(acmeSystem, {
      seed: 701,
      knobs: {
        clientCount: 0,
        rowImageFanout: false,
      },
      networkDefaults: toKernelFaults({
        oneWayDelayMeanMs: 50,
        oneWayDelayJitterMs: 20,
        packetLossProbability: 0,
        packetReplayProbability: 0,
        reorderWindow: 2,
        partitionProbability: 0,
        unpartitionProbability: 0,
      }),
    });
    const world = syncFacade(host.system);
    const a = await world.addClient({ id: 'alice' });
    await world.addClient({ id: 'bob' });

    await a.mutate(setNote, { id: 'n1', body: 'seed' });
    await world.assertConverged();

    await a.mutate(setNote, { id: 'n1', body: 'optimistic-final' });

    // Overlap upload ack with delayed / reordered query responses.
    // nudge: race post-ack sweeps with delayed sync
    void a.nudge();
    for (let i = 0; i < 16; i += 1) {
      await world.runFor(25);
      const rows = await readLiveNotes(a.db);
      const note = rows.find((r) => r.id === 'n1');
      expect(note?.body).toBe('optimistic-final');
    }

    await world.assertConverged();
    await expectLiveNote(a.db, 'n1', { body: 'optimistic-final' });
  });
});
