import { describe, expect, test } from 'bun:test';
import { start } from '@pkgs/dst';
import {
  acmeKnobs,
  acmeSystem,
  addClient,
  clearLocalData,
  connect,
  disconnect,
  expectConverged,
  mutate,
  partition,
  passTime,
  setNote,
  syncVirtualHost,
} from '../apps/acme';
import {
  expectLiveNoteAt,
  expectNoteNotLiveAt,
  liveNotes,
} from '../apps/acme/reads';

describe('cache clear preserves pending mutations', () => {
  test('cache clear wipes domain but durable queue uploads on reconnect', async () => {
    await using run = await start(acmeSystem, {
      seed: 610,
      host: syncVirtualHost(),
      knobs: acmeKnobs({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, 'alice');
    await run.apply(addClient, 'bob');

    // Disconnect so mutate queues without upload.
    await run.apply(disconnect, 'alice');
    await run.apply(mutate, 'alice', setNote, {
      id: 'n1',
      body: 'durable-queued',
    });
    await run.apply(passTime, 50);
    await expectLiveNoteAt(run, 'alice', 'n1', { body: 'durable-queued' });
    await expectNoteNotLiveAt(run, 'server', 'n1');

    await run.apply(clearLocalData, 'alice', 'cache');
    expect(await run.observe(liveNotes('alice'))).toEqual([]);
    await expectNoteNotLiveAt(run, 'alice', 'n1');

    await run.apply(connect, 'alice');
    await expectConverged(run);

    await expectLiveNoteAt(run, 'alice', 'n1', { body: 'durable-queued' });
    await expectLiveNoteAt(run, 'bob', 'n1', { body: 'durable-queued' });
    await expectLiveNoteAt(run, 'server', 'n1', { body: 'durable-queued' });
  });

  test('cache clear during sync partition does not hang on in-flight upload', async () => {
    await using run = await start(acmeSystem, {
      seed: 611,
      host: syncVirtualHost(),
      knobs: acmeKnobs({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, 'alice');
    await run.apply(partition, 'alice', 'sync');
    await run.apply(mutate, 'alice', setNote, {
      id: 'n1',
      body: 'queued-while-down',
    });
    await run.apply(clearLocalData, 'alice', 'cache');
    expect(await run.observe(liveNotes('alice'))).toEqual([]);
  });
});
