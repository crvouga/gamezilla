import { describe, expect, test } from 'bun:test';
import {
  acmeSystem,
  addClient,
  expectConverged,
  mutate,
  nudge,
  setNote,
  subscribe,
  unsubscribe,
} from '../apps/acme';
import { expectLiveNoteAt, liveFolders, liveNotes } from '../apps/acme/reads';

describe('empty tables and zero row snapshot', () => {
  test('zero-row system converges; not_modified refresh stays empty', async () => {
    await using s = await acmeSystem.script({
      seed: 1020,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, 'alice');
    await s.apply(addClient, 'bob');
    await expectConverged(s);
    expect(await s.observe(liveNotes, 'alice')).toEqual([]);
    expect(await s.observe(liveFolders, 'alice')).toEqual([]);
    expect(await s.observe(liveNotes, 'bob')).toEqual([]);

    // Verify not_modified refresh stays empty on both sides.
    await s.apply(nudge, 'alice');
    await s.apply(nudge, 'bob');
    expect(await s.observe(liveNotes, 'alice')).toEqual([]);
    await expectConverged(s);
  });

  test('absence in snapshot does not delete unrelated live rows outside scope', async () => {
    // Pin upsert contract: empty secondary scope refresh must not wipe domain.
    await using s = await acmeSystem.script({
      seed: 1021,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, 'alice');
    await s.apply(addClient, 'bob');
    await s.apply(mutate, 'alice', setNote, { id: 'keep', body: 'seed' });
    await expectConverged(s);

    await s.apply(subscribe, 'alice', 'notesDenied', {});
    await expectLiveNoteAt(s, 'alice', 'keep', { body: 'seed' });
    await s.apply(unsubscribe, 'alice', 'notesDenied');

    // Post-unsubscribe refresh must keep unrelated live rows.
    await s.apply(nudge, 'alice');
    await expectLiveNoteAt(s, 'alice', 'keep', { body: 'seed' });
    await expectConverged(s);
  });

  test.each([1022, 1023, 1024])(
    'seed sweep empty converge (seed=%i)',
    async (seed) => {
      await using s = await acmeSystem.script({
        seed,
        args: { clientCount: 0 },
      });

      await s.apply(addClient, 'alice');
      await s.apply(addClient, 'bob');
      await expectConverged(s);
      expect(await s.observe(liveNotes, 'server')).toEqual([]);
    }
  );
});
