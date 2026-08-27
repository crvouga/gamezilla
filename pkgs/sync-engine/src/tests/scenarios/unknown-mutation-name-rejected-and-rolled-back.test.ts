import { describe, expect, test } from 'bun:test';
import {
  expectLiveNote,
  expectNotesMatchServer,
  ghostMutation,
  acmeDomainPack,
  acmeMutationRegistry,
  setNote,
} from '../apps/acme';
import { openSimWorld } from '../../sim/world';

describe('unknown mutation name rejected and rolled back', () => {
  test.each([770, 771, 772])(
    'ghostMutation rejected; merge heals (seed=%i)',
    async (seed) => {
      await using world = await openSimWorld({
        domain: acmeDomainPack,
        seed,
        rowImageFanout: false,
      });
      const a = await world.addClient({
        id: 'alice',
        mutationRegistry: {
          ...acmeMutationRegistry,
          [ghostMutation.name]: ghostMutation,
        },
      });
      const b = await world.addClient({ id: 'bob' });

      await a.mutate(setNote, { id: 'n1', body: 'good' });
      await world.assertConverged();

      const rejected = await a.mutate(ghostMutation, {
        id: 'n1',
        body: 'ghost-body',
      });
      expect(rejected.ok).toBe(true);
      if (!rejected.ok) return;

      await world.until(a.outcome(rejected.mutationId));
      expect(await a.outcome(rejected.mutationId)).toBe('rejected');

      const unacked = await a.rejections();
      expect(unacked.length).toBe(1);
      expect(unacked[0]?.code).toBe('UNKNOWN_MUTATION');
      expect(unacked[0]?.mutationId).toBe(rejected.mutationId);

      await expectLiveNote(b.db, 'n1', { body: 'good' });

      await b.mutate(setNote, { id: 'bump', body: 'x' });
      await world.assertConverged();
      await expectLiveNote(a.db, 'n1', { body: 'good' });
      await expectNotesMatchServer(a.db, world.server.db);
    }
  );
});
