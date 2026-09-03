import { describe, expect, test } from 'bun:test';
import { script } from '@pkgs/dst';
import {
  acmeKnobs,
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
  syncVirtualHost,
  untilAcme,
} from '../apps/acme';

const OWNER_NOTE = { body: 'owner', title: 'taken', deletedAt: null };

describe('constraint error maps to business code', () => {
  test.each([870, 871, 872])(
    'unique conflict surfaces SLUG_TAKEN (seed=%i)',
    async (seed) => {
      await using run = await script(acmeSystem, {
        seed,
        host: syncVirtualHost(),
        knobs: acmeKnobs({ clientCount: 0, rowImageFanout: false }),
        properties: [],
      });

      await run.apply(addClient, 'alice');
      await run.apply(addClient, 'bob');

      // Bob offline so local DB lacks Alice's slug — conflict only on replay.
      await run.apply(disconnect, 'bob');
      await run.apply(mutate, 'alice', setNoteUniqueSlug, {
        id: 'n1',
        slug: 'taken',
        body: 'owner',
      });
      await run.elapse(500);
      expect(await run.observe(liveNote, 'server', 'n1')).toEqual(OWNER_NOTE);

      await run.apply(mutate, 'bob', setNoteUniqueSlug, {
        id: 'n2',
        slug: 'taken',
        body: 'conflict',
      });
      const mutationId = await run.observe(lastMutationId, 'bob');
      expect(mutationId).not.toBeNull();
      if (mutationId === null) return;

      await run.apply(connect, 'bob');
      await untilAcme(run, (s) => outcome(s, 'bob', mutationId));
      expect(await run.observe(outcome, 'bob', mutationId)).toBe('rejected');
      const unacked = await run.observe(rejections, 'bob');
      expect(unacked.some((r) => r.code === 'SLUG_TAKEN')).toBe(true);

      expect(await run.observe(liveNote, 'alice', 'n1')).toEqual(OWNER_NOTE);

      // Rejected insert left a local-only row (absence ≠ delete). Wipe cache
      // and rehydrate so converge can succeed.
      await run.apply(clearLocalData, 'bob', 'cache');
      await run.apply(connect, 'bob');
      await expectConverged(run);
      expect(await run.observe(liveNote, 'bob', 'n1')).toEqual(OWNER_NOTE);
    }
  );
});
