import { describe, expect, test } from 'bun:test';
import {
  acmeMutationRegistry,
  acmeSystem,
  addClient,
  expectConverged,
  ghostMutation,
  lastMutationId,
  mutate,
  outcome,
  rejections,
  setNote,
  untilAcme,
} from '../apps/acme';
import { expectLiveNoteAt, expectNotesAgree } from '../apps/acme/reads';

describe('unknown mutation name rejected and rolled back', () => {
  test.each([770, 771, 772])(
    'ghostMutation rejected; merge heals (seed=%i)',
    async (seed) => {
      await using s = await acmeSystem.script({
        seed,
        args: { clientCount: 0, rowImageFanout: false },
      });

      await s.apply(addClient, {
        id: 'alice',
        actorId: 'alice',
        mutationRegistry: {
          ...acmeMutationRegistry,
          [ghostMutation.name]: ghostMutation,
        },
      });
      await s.apply(addClient, 'bob');

      await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'good' });
      await expectConverged(s);

      await s.apply(mutate, 'alice', ghostMutation, {
        id: 'n1',
        body: 'ghost-body',
      });
      const mutationId = await s.observe(lastMutationId, 'alice');
      expect(mutationId).not.toBeNull();
      if (mutationId === null) return;

      await untilAcme(s, (s) => outcome(s, 'alice', mutationId));
      expect(await s.observe(outcome, 'alice', mutationId)).toBe('rejected');

      const unacked = await s.observe(rejections, 'alice');
      expect(unacked.length).toBe(1);
      expect(unacked[0]?.code).toBe('UNKNOWN_MUTATION');
      expect(unacked[0]?.mutationId).toBe(mutationId);

      await expectLiveNoteAt(s, 'bob', 'n1', { body: 'good' });

      await s.apply(mutate, 'bob', setNote, { id: 'bump', body: 'x' });
      await expectConverged(s);
      await expectLiveNoteAt(s, 'alice', 'n1', { body: 'good' });
      await expectNotesAgree(s, 'alice');
    }
  );
});
