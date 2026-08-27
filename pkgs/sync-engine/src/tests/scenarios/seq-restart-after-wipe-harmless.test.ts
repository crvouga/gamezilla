import { describe, expect, test } from 'bun:test';
import {
  expectLiveNote,
  expectNoteNotLive,
  acmeDomainPack,
  readLiveNotes,
  setNote,
} from '../apps/acme';
import { openSimWorld } from '../../sim/world';

describe('seq restart after wipe harmless', () => {
  test.each([840, 841, 842])(
    'cache clear then new mutates converge (seed=%i)',
    async (seed) => {
      await using world = await openSimWorld({
        domain: acmeDomainPack,
        seed,
      });
      const a = await world.addClient({ id: 'alice' });
      const b = await world.addClient({ id: 'bob' });

      await a.mutate(setNote, { id: 'n1', body: 'before-wipe' });
      await world.assertConverged();

      await a.clearLocalData('cache');
      expect(await readLiveNotes(a.db)).toEqual([]);
      await expectNoteNotLive(a.db, 'n1');

      await a.connect();
      await a.mutate(setNote, { id: 'n2', body: 'after-wipe' });
      await world.assertConverged();

      await expectLiveNote(a.db, 'n1', { body: 'before-wipe' });
      await expectLiveNote(a.db, 'n2', { body: 'after-wipe' });
      await expectLiveNote(b.db, 'n2', { body: 'after-wipe' });
    }
  );
});
