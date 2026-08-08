import { describe, expect, test } from 'bun:test';
import {
  expectLiveNote,
  expectNoteNotLive,
  expectNotesMatchServer,
  notesDomainPack,
  readLiveNotes,
  setNote,
} from '../../domain-packs/notes-app';
import { RELIABLE_FAULTS } from '../../sim/faults';
import { openSimWorld } from '../../sim/world';

describe('mutate local apply and queue atomic under crash', () => {
  test('crash after mutate resolves offline: write everywhere or nowhere', async () => {
    const world = await openSimWorld({
      domain: notesDomainPack,
      seed: 831,
      faults: RELIABLE_FAULTS,
    });
    try {
      const a = await world.addClient({ id: 'alice' });
      const b = await world.addClient({ id: 'bob' });

      await a.mutate(setNote, { id: 'warm', body: 'w' });
      await world.assertConverged();

      a.lifecycle.setOnline(false);
      world.armCrash('alice', 'afterNextMutateResolved');
      const result = await a.mutate(setNote, {
        id: 'atomic',
        body: 'queued-or-absent',
      });
      // Crash fires after mutate resolves — alice handle is disposed.
      expect(world.clients.has('alice')).toBe(false);
      expect(result.ok).toBe(true);

      const alice = await world.restartClient('alice', {
        preserveLocalDb: true,
      });
      alice.lifecycle.setOnline(true);
      alice.engine.wakeUploads();
      await world.assertConverged();

      const onServer = (await readLiveNotes(world.server.db)).some(
        (r) => r.id === 'atomic' && r.body === 'queued-or-absent'
      );
      if (onServer) {
        await expectLiveNote(alice.db, 'atomic', { body: 'queued-or-absent' });
        await expectLiveNote(b.db, 'atomic', { body: 'queued-or-absent' });
      } else {
        await expectNoteNotLive(alice.db, 'atomic');
        await expectNoteNotLive(b.db, 'atomic');
      }
      await expectNotesMatchServer(alice.db, world.server.db);
      await expectNotesMatchServer(b.db, world.server.db);
    } finally {
      await world.dispose();
    }
  });
});
