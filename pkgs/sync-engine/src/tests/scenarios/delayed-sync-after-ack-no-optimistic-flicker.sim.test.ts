import { describe, expect, test } from 'bun:test';
import { start } from '@pkgs/dst';
import {
  acmeDraws,
  acmeSystem,
  addClient,
  converge,
  expectLiveNoteAt,
  liveNotes,
  mutate,
  net,
  nudge,
  passTime,
  setNote,
  syncVirtualHost,
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
    await using run = await start(acmeSystem, {
      seed: 701,
      host: syncVirtualHost(),
      draws: acmeDraws({
        clientCount: 0,
        rowImageFanout: false,
      }),
      properties: [],
    });

    await run.apply(addClient, { id: 'alice' });
    await run.apply(addClient, { id: 'bob' });
    await run.apply(net, 'alice', 'all', DELAYED_SYNC_FAULTS);
    await run.apply(net, 'bob', 'all', DELAYED_SYNC_FAULTS);

    await run.apply(mutate, 'alice', setNote, { id: 'n1', body: 'seed' });
    await run.apply(converge);

    await run.apply(mutate, 'alice', setNote, {
      id: 'n1',
      body: 'optimistic-final',
    });

    // Overlap upload ack with delayed / reordered query responses:
    // nudge races post-ack sweeps with delayed sync.
    await run.apply(nudge, 'alice');
    for (let i = 0; i < 16; i += 1) {
      await run.apply(passTime, 25);
      const rows = await run.observe(liveNotes('alice'));
      const note = rows.find((r) => r.id === 'n1');
      expect(note?.body).toBe('optimistic-final');
    }

    await run.apply(converge);
    await expectLiveNoteAt(run, 'alice', 'n1', { body: 'optimistic-final' });
  });
});
