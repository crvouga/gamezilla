import { describe, expect, test } from 'bun:test';
import {
  acmeSystem,
  addClient,
  clearLocalData,
  connect,
  disconnect,
  expectConverged,
  expectNoteNotLiveAt,
  liveNote,
  liveNotes,
  mutate,
  setNote,
} from '../apps/acme';

describe('seq restart after wipe harmless', () => {
  test.each([840, 841, 842])(
    'cache clear then new mutates converge (seed=%i)',
    async (seed) => {
      await using s = await acmeSystem.script({
        seed: seed,
        args: { clientCount: 0 },
      });

      await s.apply(addClient, 'alice');
      await s.apply(addClient, 'bob');

      await s.apply(mutate, 'alice', setNote, {
        id: 'n1',
        body: 'before-wipe',
      });
      await expectConverged(s);

      // Offline while wiping: no resync may repaint the cache mid-check.
      await s.apply(disconnect, 'alice');
      await s.apply(clearLocalData, 'alice', 'cache');
      expect(await s.observe(liveNotes, 'alice')).toEqual([]);
      await expectNoteNotLiveAt(s, 'alice', 'n1');

      await s.apply(connect, 'alice');
      await s.apply(mutate, 'alice', setNote, {
        id: 'n2',
        body: 'after-wipe',
      });
      await expectConverged(s);

      expect(await s.observe(liveNote, 'alice', 'n1')).toMatchObject({
        body: 'before-wipe',
      });
      expect(await s.observe(liveNote, 'alice', 'n2')).toMatchObject({
        body: 'after-wipe',
      });
      expect(await s.observe(liveNote, 'bob', 'n2')).toMatchObject({
        body: 'after-wipe',
      });
    }
  );
});
