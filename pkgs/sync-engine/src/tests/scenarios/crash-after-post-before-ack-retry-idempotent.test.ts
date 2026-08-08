import { describe, expect, test } from 'bun:test';
import {
  expectLiveNote,
  expectNotesMatchServer,
  notesDomainPack,
  readLiveNotes,
  setNote,
} from '../../domain-packs/notes-app';
import { RELIABLE_FAULTS } from '../../sim/faults';
import { openSimWorld } from '../../sim/world';

describe('crash after post before ack retry idempotent', () => {
  test('crash after mutations POST accepted; restart re-drains idempotently', async () => {
    const world = await openSimWorld({
      domain: notesDomainPack,
      seed: 832,
      faults: RELIABLE_FAULTS,
    });
    try {
      const a = await world.addClient({ id: 'alice' });
      const b = await world.addClient({ id: 'bob' });

      await a.mutate(setNote, { id: 'warm', body: 'w' });
      await world.assertConverged();

      world.armCrash('alice', 'afterNextMutationsPostAccepted');
      const queued = await a.mutate(setNote, {
        id: 'n1',
        body: 'post-accepted',
      });
      expect(queued.ok).toBe(true);
      await world.runFor(500);

      expect(world.clients.has('alice')).toBe(false);
      // Server applied before crash; client may re-upload on restart.
      await expectLiveNote(world.server.db, 'n1', { body: 'post-accepted' });

      const alice = await world.restartClient('alice', {
        preserveLocalDb: true,
      });
      alice.engine.wakeUploads();
      await world.assertConverged();

      const server = await readLiveNotes(world.server.db);
      expect(server.filter((r) => r.id === 'n1').length).toBe(1);
      await expectLiveNote(alice.db, 'n1', { body: 'post-accepted' });
      await expectLiveNote(b.db, 'n1', { body: 'post-accepted' });
      await expectNotesMatchServer(alice.db, world.server.db);
    } finally {
      await world.dispose();
    }
  });
});
