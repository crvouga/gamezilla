import { describe, expect, test } from 'bun:test';
import { start } from '@pkgs/dst';
import {
  acmeDraws,
  acmeSystem,
  addClient,
  expectConverged,
  mutate,
  nudge,
  setNote,
  subscribe,
  syncVirtualHost,
  unsubscribe,
} from '../apps/acme';
import { expectLiveNoteAt, liveFolders, liveNotes } from '../apps/acme/reads';

describe('empty tables and zero row snapshot', () => {
  test('zero-row system converges; not_modified refresh stays empty', async () => {
    await using run = await start(acmeSystem, {
      seed: 1020,
      host: syncVirtualHost(),
      draws: acmeDraws({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, 'alice');
    await run.apply(addClient, 'bob');
    await expectConverged(run);
    expect(await run.observe(liveNotes('alice'))).toEqual([]);
    expect(await run.observe(liveFolders('alice'))).toEqual([]);
    expect(await run.observe(liveNotes('bob'))).toEqual([]);

    // Verify not_modified refresh stays empty on both sides.
    await run.apply(nudge, 'alice');
    await run.apply(nudge, 'bob');
    expect(await run.observe(liveNotes('alice'))).toEqual([]);
    await expectConverged(run);
  });

  test('absence in snapshot does not delete unrelated live rows outside scope', async () => {
    // Pin upsert contract: empty secondary scope refresh must not wipe domain.
    await using run = await start(acmeSystem, {
      seed: 1021,
      host: syncVirtualHost(),
      draws: acmeDraws({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, 'alice');
    await run.apply(addClient, 'bob');
    await run.apply(mutate, 'alice', setNote, { id: 'keep', body: 'seed' });
    await expectConverged(run);

    await run.apply(subscribe, 'alice', 'notesDenied', {});
    await expectLiveNoteAt(run, 'alice', 'keep', { body: 'seed' });
    await run.apply(unsubscribe, 'alice', 'notesDenied');

    // Post-unsubscribe refresh must keep unrelated live rows.
    await run.apply(nudge, 'alice');
    await expectLiveNoteAt(run, 'alice', 'keep', { body: 'seed' });
    await expectConverged(run);
  });

  test.each([1022, 1023, 1024])(
    'seed sweep empty converge (seed=%i)',
    async (seed) => {
      await using run = await start(acmeSystem, {
        seed,
        host: syncVirtualHost(),
        draws: acmeDraws({ clientCount: 0 }),
        properties: [],
      });

      await run.apply(addClient, 'alice');
      await run.apply(addClient, 'bob');
      await expectConverged(run);
      expect(await run.observe(liveNotes('server'))).toEqual([]);
    }
  );
});
