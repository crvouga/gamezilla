import { describe, expect, test } from 'bun:test';
import {
  acmeSystem,
  addClient,
  clearLocalData,
  connect,
  disconnect,
  expectConverged,
  lastMutationId,
  liveNote,
  mutate,
  outcome,
  rejections,
  setNoteUniqueSlug,
  untilAcme,
} from '../apps/acme';

const OWNER_NOTE = { body: 'owner', title: 'taken', deletedAt: null };

describe('constraint error maps to business code', () => {
  test.each([870, 871, 872])(
    'unique conflict surfaces SLUG_TAKEN (seed=%i)',
    async (seed) => {
      await using s = await acmeSystem.script({
        seed,
        args: { clientCount: 0, rowImageFanout: false },
      });

      await s.apply(addClient, 'alice');
      await s.apply(addClient, 'bob');

      // Bob offline so local DB lacks Alice's slug — conflict only on replay.
      await s.apply(disconnect, 'bob');
      await s.apply(mutate, 'alice', setNoteUniqueSlug, {
        id: 'n1',
        slug: 'taken',
        body: 'owner',
      });
      await s.elapse(500);
      expect(await s.observe(liveNote, 'server', 'n1')).toEqual(OWNER_NOTE);

      await s.apply(mutate, 'bob', setNoteUniqueSlug, {
        id: 'n2',
        slug: 'taken',
        body: 'conflict',
      });
      const mutationId = await s.observe(lastMutationId, 'bob');
      expect(mutationId).not.toBeNull();
      if (mutationId === null) return;

      await s.apply(connect, 'bob');
      await untilAcme(s, (s) => outcome(s, 'bob', mutationId));
      expect(await s.observe(outcome, 'bob', mutationId)).toBe('rejected');
      const unacked = await s.observe(rejections, 'bob');
      expect(unacked.some((r) => r.code === 'SLUG_TAKEN')).toBe(true);

      expect(await s.observe(liveNote, 'alice', 'n1')).toEqual(OWNER_NOTE);

      // Rejected insert left a local-only row (absence ≠ delete). Wipe cache
      // and rehydrate so converge can succeed.
      await s.apply(clearLocalData, 'bob', 'cache');
      await s.apply(connect, 'bob');
      await expectConverged(s);
      expect(await s.observe(liveNote, 'bob', 'n1')).toEqual(OWNER_NOTE);
    }
  );
});
