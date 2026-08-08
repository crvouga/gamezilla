import { describe, expect, test } from 'bun:test';
import {
  expectLiveNote,
  expectNoteNotLive,
  notesDomainPack,
  readLiveNotes,
  setNote,
} from '../../domain-packs/notes-app';
import { openSimWorld } from '../../sim/world';

describe('cache clear preserves pending mutations', () => {
  test('cache clear wipes domain but durable queue uploads on reconnect', async () => {
    await using world = await openSimWorld({
      domain: notesDomainPack,
      seed: 610,
    });
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
});
