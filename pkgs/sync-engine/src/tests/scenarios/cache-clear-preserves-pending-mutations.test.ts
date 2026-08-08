import { describe, expect, test } from 'bun:test';
import {
  expectLiveNote,
  expectNoteNotLive,
  notesDomainPack,
  readLiveNotes,
  setNote,
} from '../../domain-packs/notes-app';
import { RELIABLE_FAULTS } from '../../sim/faults';
import { openSimWorld } from '../../sim/world';

describe('cache clear preserves pending mutations', () => {
  test('cache clear wipes domain but durable queue uploads on reconnect', async () => {
    const world = await openSimWorld({
      domain: notesDomainPack,
      seed: 610,
      faults: RELIABLE_FAULTS,
    });
    try {
      const a = await world.addClient({ id: 'alice' });
      const b = await world.addClient({ id: 'bob' });

      // Disconnect so mutate queues without upload.
      await a.engine.disconnect();
      await a.mutate(setNote, { id: 'n1', body: 'durable-queued' });
      await world.runFor(50);
      await expectLiveNote(a.db, 'n1', { body: 'durable-queued' });
      await expectNoteNotLive(world.server.db, 'n1');

      await a.engine.clearLocalData({ reason: 'cache' });
      expect(await readLiveNotes(a.db)).toEqual([]);
      await expectNoteNotLive(a.db, 'n1');

      await a.engine.connect();
      a.engine.wakeUploads();
      await world.assertConverged();

      await expectLiveNote(a.db, 'n1', { body: 'durable-queued' });
      await expectLiveNote(b.db, 'n1', { body: 'durable-queued' });
      await expectLiveNote(world.server.db, 'n1', { body: 'durable-queued' });
    } finally {
      await world.dispose();
    }
  });
});
