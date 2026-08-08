import { describe, expect, test } from 'bun:test';
import { SCHEMA_EPOCH } from '@pkgs/sync-engine/client';
import {
  expectLiveNote,
  expectNoteNotLive,
  expectNotesMatchServer,
  notesDomainPack,
  setNote,
} from '../../domain-packs/notes-app';
import { RELIABLE_FAULTS } from '../../sim/faults';
import { openSimWorld } from '../../sim/world';

describe('crash during epoch migrate recovers', () => {
  test('crash after cache wipe mid migrate; next boot drains pending', async () => {
    const world = await openSimWorld({
      domain: notesDomainPack,
      seed: 834,
      faults: RELIABLE_FAULTS,
    });
    try {
      const a = await world.addClient({ id: 'alice' });
      const b = await world.addClient({ id: 'bob' });

      await a.mutate(setNote, { id: 'kept', body: 'on-server' });
      await world.assertConverged();

      await a.engine.disconnect();
      await a.mutate(setNote, { id: 'pending', body: 'durable' });
      await world.runFor(50);
      await expectLiveNote(a.db, 'pending', { body: 'durable' });
      await expectNoteNotLive(world.server.db, 'pending');

      world.armCrash('alice', 'onNextEngineOpenAfterCacheWipe');
      await expect(
        world.restartClient('alice', {
          preserveLocalDb: true,
          schemaEpoch: SCHEMA_EPOCH + 1,
        })
      ).rejects.toThrow(/crash during epoch migrate/);

      expect(world.clients.has('alice')).toBe(false);

      const alice = await world.restartClient('alice', {
        preserveLocalDb: true,
        schemaEpoch: SCHEMA_EPOCH + 1,
      });
      alice.engine.wakeUploads();
      await world.assertConverged();

      await expectLiveNote(alice.db, 'pending', { body: 'durable' });
      await expectLiveNote(b.db, 'pending', { body: 'durable' });
      await expectLiveNote(alice.db, 'kept', { body: 'on-server' });
      await expectNotesMatchServer(alice.db, world.server.db);
    } finally {
      await world.dispose();
    }
  });
});
