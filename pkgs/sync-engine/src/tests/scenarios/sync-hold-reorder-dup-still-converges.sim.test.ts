import { describe, test } from 'bun:test';
import {
  acmeSystem,
  addClient,
  expectConverged,
  expectEveryClientNotesAgree,
  expectLiveNoteAt,
  hold,
  mutate,
  net,
  setNote,
} from '../apps/acme';

describe('sync hold reorder dup still converges', () => {
  test('held sync still converges after release', async () => {
    await using s = await acmeSystem.script({
      seed: 503,
      args: {
        clientCount: 0,
        rowImageFanout: false,
      },
    });

    await s.apply(addClient, { id: 'alice' });
    await s.apply(addClient, { id: 'bob' });
    await s.apply(mutate, 'alice', setNote, { id: 'warm', body: 'w' });
    await expectConverged(s);

    await s.apply(hold, 'bob', 'sync');
    await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'held-sync' });
    await s.elapse(80);

    await expectConverged(s);
    await expectLiveNoteAt(s, 'bob', 'n1', { body: 'held-sync' });
    await expectEveryClientNotesAgree(s);
  });

  test('reordered sync still converges', async () => {
    await using s = await acmeSystem.script({
      seed: 504,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, { id: 'alice' });
    await s.apply(addClient, { id: 'bob' });
    await s.apply(net, 'bob', 'sync', {
      latencyMeanMs: 20,
      latencyJitterMs: 40,
      reorderWindow: 5,
    });
    await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'a' });
    await s.apply(mutate, 'alice', setNote, { id: 'n2', body: 'b' });
    await s.apply(mutate, 'alice', setNote, { id: 'n3', body: 'c' });
    await expectConverged(s);
    await expectLiveNoteAt(s, 'bob', 'n2', { body: 'b' });
    await expectEveryClientNotesAgree(s);
  });

  test('duplicate sync still converges', async () => {
    await using s = await acmeSystem.script({
      seed: 505,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, { id: 'alice' });
    await s.apply(addClient, { id: 'bob' });
    await s.apply(net, 'bob', 'sync', { packetReplayProbability: 1 });
    await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'dup-sync' });
    await expectConverged(s);
    await expectLiveNoteAt(s, 'bob', 'n1', { body: 'dup-sync' });
    await expectEveryClientNotesAgree(s);
  });
});
