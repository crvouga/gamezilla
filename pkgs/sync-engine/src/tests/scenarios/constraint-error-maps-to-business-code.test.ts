import { describe, expect, test } from 'bun:test';
import {
  expectLiveNote,
  notesDomainPack,
  setNoteUniqueSlug,
} from '../../domain-packs/notes-app';
import { openSimWorld } from '../../sim/world';

describe('constraint error maps to business code', () => {
  test.each([870, 871, 872])(
    'unique conflict surfaces SLUG_TAKEN (seed=%i)',
    async (seed) => {
      await using world = await openSimWorld({
        domain: notesDomainPack,
        seed,
        rowImageFanout: false,
      });
      const a = await world.addClient({ id: 'alice' });
      const b = await world.addClient({ id: 'bob' });

      // Bob offline so local DB lacks Alice's slug — conflict only on replay.
      await b.disconnect();
      await a.mutate(setNoteUniqueSlug, {
        id: 'n1',
        slug: 'taken',
        body: 'owner',
      });
      await world.runFor(500);
      await expectLiveNote(world.server.db, 'n1', {
        body: 'owner',
        title: 'taken',
      });

      const rejected = await b.mutate(setNoteUniqueSlug, {
        id: 'n2',
        slug: 'taken',
        body: 'conflict',
      });
      expect(rejected.ok).toBe(true);
      if (!rejected.ok) return;

      await b.connect();
      await world.until(b.outcome(rejected.mutationId), { budgetMs: 5_000 });
      expect(await b.outcome(rejected.mutationId)).toBe('rejected');
      const unacked = await b.rejections();
      expect(unacked.some((r) => r.code === 'SLUG_TAKEN')).toBe(true);

      await expectLiveNote(a.db, 'n1', { body: 'owner', title: 'taken' });

      // Rejected insert left a local-only row (absence ≠ delete). Wipe cache
      // and rehydrate so converge can succeed.
      await b.clearLocalData('cache');
      await b.connect();
      await world.assertConverged();
      await expectLiveNote(b.db, 'n1', { body: 'owner', title: 'taken' });
    }
  );
});
