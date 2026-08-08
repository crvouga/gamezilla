import { describe, test } from 'bun:test';
import { SCHEMA_EPOCH } from '@pkgs/sync-engine/client';
import {
  expectLiveNote,
  expectNoteNotLive,
  notesDomainPack,
  setNote,
} from '../../domain-packs/notes-app';
import { RELIABLE_FAULTS } from '../../sim/faults';
import { openSimWorld } from '../../sim/world';

describe('epoch bump wipes cache preserves pending uploads', () => {
  for (const seed of [710, 711, 712]) {
    test(`offline pending survives epoch bump (seed=${seed})`, async () => {
      const world = await openSimWorld({
        domain: notesDomainPack,
        seed,
        faults: RELIABLE_FAULTS,
      });
      try {
        const a = await world.addClient({ id: 'alice' });
        const b = await world.addClient({ id: 'bob' });

        await b.mutate(setNote, { id: 'peer', body: 'from-bob' });
        await world.assertConverged();

        await a.engine.disconnect();
        await a.mutate(setNote, { id: 'n1', body: 'queued' });
        await world.runFor(50);
        await expectNoteNotLive(world.server.db, 'n1');

        const alice2 = await world.restartClient('alice', {
          preserveLocalDb: true,
          schemaEpoch: SCHEMA_EPOCH + 1,
        });
        await world.assertConverged();

        await expectLiveNote(alice2.db, 'n1', { body: 'queued' });
        await expectLiveNote(alice2.db, 'peer', { body: 'from-bob' });
        await expectLiveNote(b.db, 'n1', { body: 'queued' });
        await expectLiveNote(world.server.db, 'n1', { body: 'queued' });
      } finally {
        await world.dispose();
      }
    });
  }
});
