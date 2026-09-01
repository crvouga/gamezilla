import { openWorld } from '@pkgs/determinism';
import { acmeSystem } from '../apps/acme/system';
import { syncFacade } from '../../sim/system';
import { describe, expect, test } from 'bun:test';
import { expectLiveNote, expectNoteNotLive, readLiveNotes, setNote } from '../apps/acme';

describe('cache clear preserves pending mutations', () => {
  test('cache clear wipes domain but durable queue uploads on reconnect', async () => {
    await using host = await openWorld(acmeSystem, {
      seed: 610,
      knobs: {
        clientCount: 0,
      },
    });
    const world = syncFacade(host.system);
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });

    // Disconnect so mutate queues without upload.
    await a.disconnect();
    await a.mutate(setNote, { id: 'n1', body: 'durable-queued' });
    await world.runFor(50);
    await expectLiveNote(a.db, 'n1', { body: 'durable-queued' });
    await expectNoteNotLive(world.server.db, 'n1');

    await a.clearLocalData('cache');
    expect(await readLiveNotes(a.db)).toEqual([]);
    await expectNoteNotLive(a.db, 'n1');

    await a.connect();
    await world.assertConverged();

    await expectLiveNote(a.db, 'n1', { body: 'durable-queued' });
    await expectLiveNote(b.db, 'n1', { body: 'durable-queued' });
    await expectLiveNote(world.server.db, 'n1', { body: 'durable-queued' });
  });

  test('cache clear during sync partition does not hang on in-flight upload', async () => {
    await using host = await openWorld(acmeSystem, {
      seed: 611,
      knobs: {
        clientCount: 0,
      },
    });
    const world = syncFacade(host.system);
    const a = await world.addClient({ id: 'alice' });
    using _down = world.net('alice', 'sync').set('down');
    await a.mutate(setNote, { id: 'n1', body: 'queued-while-down' });
    await a.clearLocalData('cache');
    expect(await readLiveNotes(a.db)).toEqual([]);
  });
});
