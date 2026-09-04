import { describe, expect, test } from 'bun:test';
import {
  acmeSystem,
  addClient,
  clearLocalData,
  connect,
  disconnect,
  expectConverged,
  mutate,
  partition,
  setNote,
} from '../apps/acme';
import {
  expectLiveNoteAt,
  expectNoteNotLiveAt,
  liveNotes,
} from '../apps/acme/reads';

describe('cache clear preserves pending mutations', () => {
  test('cache clear wipes domain but durable queue uploads on reconnect', async () => {
    await using s = await acmeSystem.script({
      seed: 610,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, 'alice');
    await s.apply(addClient, 'bob');

    // Disconnect so mutate queues without upload.
    await s.apply(disconnect, 'alice');
    await s.apply(mutate, 'alice', setNote, {
      id: 'n1',
      body: 'durable-queued',
    });
    await s.elapse(50);
    await expectLiveNoteAt(s, 'alice', 'n1', { body: 'durable-queued' });
    await expectNoteNotLiveAt(s, 'server', 'n1');

    await s.apply(clearLocalData, 'alice', 'cache');
    expect(await s.observe(liveNotes, 'alice')).toEqual([]);
    await expectNoteNotLiveAt(s, 'alice', 'n1');

    await s.apply(connect, 'alice');
    await expectConverged(s);

    await expectLiveNoteAt(s, 'alice', 'n1', { body: 'durable-queued' });
    await expectLiveNoteAt(s, 'bob', 'n1', { body: 'durable-queued' });
    await expectLiveNoteAt(s, 'server', 'n1', { body: 'durable-queued' });
  });

  test('cache clear during sync partition does not hang on in-flight upload', async () => {
    await using s = await acmeSystem.script({
      seed: 611,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, 'alice');
    await s.apply(partition, 'alice', 'sync');
    await s.apply(mutate, 'alice', setNote, {
      id: 'n1',
      body: 'queued-while-down',
    });
    await s.apply(clearLocalData, 'alice', 'cache');
    expect(await s.observe(liveNotes, 'alice')).toEqual([]);
  });
});
