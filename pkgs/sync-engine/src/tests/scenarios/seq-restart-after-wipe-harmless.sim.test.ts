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
  expectNoteNotLiveAt,
  liveNote,
  liveNotes,
  mutate,
  setNote,
  syncVirtualHost,
} from '../apps/acme';

describe('seq restart after wipe harmless', () => {
  test.each([840, 841, 842])(
    'cache clear then new mutates converge (seed=%i)',
    async (seed) => {
      await using run = await script(acmeSystem, {
        seed: seed,
        host: syncVirtualHost(),
        knobs: acmeKnobs({ clientCount: 0 }),
        properties: [],
      });

      await run.apply(addClient, 'alice');
      await run.apply(addClient, 'bob');

      await run.apply(mutate, 'alice', setNote, {
        id: 'n1',
        body: 'before-wipe',
      });
      await expectConverged(run);

      // Offline while wiping: no resync may repaint the cache mid-check.
      await run.apply(disconnect, 'alice');
      await run.apply(clearLocalData, 'alice', 'cache');
      expect(await run.observe(liveNotes('alice'))).toEqual([]);
      await expectNoteNotLiveAt(run, 'alice', 'n1');

      await run.apply(connect, 'alice');
      await run.apply(mutate, 'alice', setNote, {
        id: 'n2',
        body: 'after-wipe',
      });
      await expectConverged(run);

      expect(await run.observe(liveNote('alice', 'n1'))).toMatchObject({
        body: 'before-wipe',
      });
      expect(await run.observe(liveNote('alice', 'n2'))).toMatchObject({
        body: 'after-wipe',
      });
      expect(await run.observe(liveNote('bob', 'n2'))).toMatchObject({
        body: 'after-wipe',
      });
    }
  );
});
