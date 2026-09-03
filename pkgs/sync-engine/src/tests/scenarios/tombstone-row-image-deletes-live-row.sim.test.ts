import { describe, expect, test } from 'bun:test';
import { start } from '@pkgs/dst';
import {
  acmeKnobs,
  acmeSystem,
  addClient,
  deleteNote,
  expectConverged,
  expectLiveNoteAt,
  expectNoteNotLiveAt,
  lastMutationOk,
  mutate,
  net,
  passTime,
  readNoteTombstoneAt,
  setNote,
  syncVirtualHost,
} from '../apps/acme';

describe('tombstone row image deletes live row', () => {
  test('delete row image removes live peer row without waiting on sync', async () => {
    await using run = await start(acmeSystem, {
      seed: 806,
      host: syncVirtualHost(),
      knobs: acmeKnobs({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, { id: 'alice' });
    await run.apply(addClient, { id: 'bob' });

    await run.apply(mutate, 'alice', setNote, { id: 'n1', body: 'alive' });
    await expectConverged(run);
    await expectLiveNoteAt(run, 'bob', 'n1', { body: 'alive' });

    await run.apply(net, 'bob', 'sync', 'hold');
    await run.apply(mutate, 'alice', deleteNote, { id: 'n1' });
    expect(await run.observe(lastMutationOk('alice'))).toBe(true);
    await run.apply(passTime, 300);

    await expectNoteNotLiveAt(run, 'bob', 'n1');
    expect(await readNoteTombstoneAt(run, 'bob', 'n1')).not.toBeNull();

    await expectConverged(run);
    await expectNoteNotLiveAt(run, 'bob', 'n1');
  });
});
