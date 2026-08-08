import { describe, test } from 'bun:test';
import { SCHEMA_EPOCH } from '@pkgs/sync-engine/test';
import {
  expectLiveNote,
  isLiveNote,
  notesDomainPack,
  setNote,
} from '../../domain-packs/notes-app';
import { openSimWorld } from '../../sim/world';

describe('epoch bump wipes cache preserves pending uploads', () => {
  test.each([710, 711, 712])(
    'offline pending survives epoch bump (seed=%i)',
    async (seed) => {
      await using world = await openSimWorld({
        domain: notesDomainPack,
        seed,
      });
      const a = await world.addClient({ id: 'alice' });
      const b = await world.addClient({ id: 'bob' });

      await b.mutate(setNote, { id: 'peer', body: 'from-bob' });
      await world.assertConverged();

      await a.disconnect();
      await a.mutate(setNote, { id: 'n1', body: 'queued' });
      await world.never(() => isLiveNote(world.server.db, 'n1'), { forMs: 50 });

      const alice2 = await world.node('alice').restart({
        preserveLocalDb: true,
        schemaEpoch: SCHEMA_EPOCH + 1,
      });
      await world.assertConverged();

      await expectLiveNote(alice2!.db, 'n1', { body: 'queued' });
      await expectLiveNote(alice2!.db, 'peer', { body: 'from-bob' });
      await expectLiveNote(b.db, 'n1', { body: 'queued' });
      await expectLiveNote(world.server.db, 'n1', { body: 'queued' });
    }
  );
});
