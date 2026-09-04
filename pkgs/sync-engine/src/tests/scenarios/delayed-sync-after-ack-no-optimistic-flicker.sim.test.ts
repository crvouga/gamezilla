import { describe, expect, test } from 'bun:test';
import {
  acmeSystem,
  addClient,
  expectConverged,
  expectLiveNoteAt,
  liveNotes,
  mutate,
  net,
  nudge,
  setNote,
} from '../apps/acme';

const DELAYED_SYNC_FAULTS = {
  latencyMeanMs: 50,
  latencyJitterMs: 20,
  dropProbability: 0,
  packetReplayProbability: 0,
  reorderWindow: 2,
  partitionProbability: 0,
  healProbability: 0,
} as const;

describe('delayed sync after ack no optimistic flicker', () => {
  test('optimistic body never reverts under delayed sync after upload ack', async () => {
    await using s = await acmeSystem.script({
      seed: 701,
      args: {
        clientCount: 0,
        rowImageFanout: false,
      },
    });

    await s.apply(addClient, { id: 'alice' });
    await s.apply(addClient, { id: 'bob' });
    await s.apply(net, 'alice', 'all', DELAYED_SYNC_FAULTS);
    await s.apply(net, 'bob', 'all', DELAYED_SYNC_FAULTS);

    await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'seed' });
    await expectConverged(s);

    await s.apply(mutate, 'alice', setNote, {
      id: 'n1',
      body: 'optimistic-final',
    });

    // Overlap upload ack with delayed / reordered query responses:
    // nudge races post-ack sweeps with delayed sync.
    await s.apply(nudge, 'alice');
    for (let i = 0; i < 16; i += 1) {
      await s.elapse(25);
      const rows = await s.observe(liveNotes, 'alice');
      const note = rows.find((r) => r.id === 'n1');
      expect(note?.body).toBe('optimistic-final');
    }

    await expectConverged(s);
    await expectLiveNoteAt(s, 'alice', 'n1', { body: 'optimistic-final' });
  });
});
