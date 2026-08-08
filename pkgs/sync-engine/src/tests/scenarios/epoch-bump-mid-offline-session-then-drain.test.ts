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

describe('epoch bump mid offline session then drain', () => {
  for (const seed of [720, 721, 722]) {
    test(`offline upgrade drains after later connect (seed=${seed})`, async () => {
      const world = await openSimWorld({
        domain: notesDomainPack,
        seed,
        faults: RELIABLE_FAULTS,
      });
      try {
        const a = await world.addClient({ id: 'alice' });
        const b = await world.addClient({ id: 'bob' });

        // Disconnect so mutate queues without upload (lifecycle online alone
        // still allows HTTP in this sim).
        await a.engine.disconnect();
        await a.mutate(setNote, { id: 'n1', body: 'mid-offline' });
        await world.runFor(50);
        await expectNoteNotLive(world.server.db, 'n1');

        // Restart applies epoch wipe on preserved DB; engine reconnects for
        // session sync (sim always boots online). Pending durable uploads drain.
        const alice2 = await world.restartClient('alice', {
          preserveLocalDb: true,
          schemaEpoch: SCHEMA_EPOCH + 1,
        });
        await world.assertConverged();

        await expectLiveNote(alice2.db, 'n1', { body: 'mid-offline' });
        await expectLiveNote(b.db, 'n1', { body: 'mid-offline' });
      } finally {
        await world.dispose();
      }
    });
  }
});
