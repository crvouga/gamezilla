import { describe, expect, test } from 'bun:test';
import { start } from '@pkgs/dst';
import {
  acmeDraws,
  acmeMutationRegistry,
  acmeSystem,
  addClient,
  assertConverged,
  ghostMutation,
  lastMutationId,
  mutate,
  outcome,
  rejections,
  setNote,
  syncVirtualHost,
  untilAcme,
} from '../apps/acme';
import { expectLiveNoteAt, expectNotesAgree } from '../apps/acme/reads';

describe('unknown mutation name rejected and rolled back', () => {
  test.each([770, 771, 772])(
    'ghostMutation rejected; merge heals (seed=%i)',
    async (seed) => {
      await using run = await start(acmeSystem, {
        seed,
        host: syncVirtualHost(),
        draws: acmeDraws({ clientCount: 0, rowImageFanout: false }),
        properties: [],
      });

      await run.apply(addClient, {
        id: 'alice',
        actorId: 'alice',
        mutationRegistry: {
          ...acmeMutationRegistry,
          [ghostMutation.name]: ghostMutation,
        },
      });
      await run.apply(addClient, 'bob');

      await run.apply(mutate, 'alice', setNote, { id: 'n1', body: 'good' });
      await run.apply(assertConverged);

      await run.apply(mutate, 'alice', ghostMutation, {
        id: 'n1',
        body: 'ghost-body',
      });
      const mutationId = await run.observe(lastMutationId('alice'));
      expect(mutationId).not.toBeNull();
      if (mutationId === null) return;

      await untilAcme(run, outcome('alice', mutationId));
      expect(await run.observe(outcome('alice', mutationId))).toBe('rejected');

      const unacked = await run.observe(rejections('alice'));
      expect(unacked.length).toBe(1);
      expect(unacked[0]?.code).toBe('UNKNOWN_MUTATION');
      expect(unacked[0]?.mutationId).toBe(mutationId);

      await expectLiveNoteAt(run, 'bob', 'n1', { body: 'good' });

      await run.apply(mutate, 'bob', setNote, { id: 'bump', body: 'x' });
      await run.apply(assertConverged);
      await expectLiveNoteAt(run, 'alice', 'n1', { body: 'good' });
      await expectNotesAgree(run, 'alice');
    }
  );
});
