import { describe, expect, test } from 'bun:test';
import { start } from '@pkgs/dst';
import {
  acmeDraws,
  acmeSystem,
  addClient,
  assertConverged,
  deleteNote,
  lastMutationOk,
  mutate,
  setNote,
  syncVirtualHost,
} from '../apps/acme';
import {
  expectLiveNoteAt,
  expectNoteNotLiveAt,
  readNoteTombstoneAt,
} from '../apps/acme/reads';

describe('soft delete tombstone propagates and revives', () => {
  test('delete tombstones on peer after converge', async () => {
    await using run = await start(acmeSystem, {
      seed: 13,
      host: syncVirtualHost(),
      draws: acmeDraws({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, 'alice');
    await run.apply(addClient, 'bob');

    await run.apply(mutate, 'alice', setNote, { id: 'n1', body: 'x' });
    await run.apply(assertConverged);

    await run.apply(mutate, 'alice', deleteNote, { id: 'n1' });
    expect(await run.observe(lastMutationOk('alice'))).toBe(true);
    await run.apply(assertConverged);

    await expectNoteNotLiveAt(run, 'bob', 'n1');
    expect(await readNoteTombstoneAt(run, 'bob', 'n1')).not.toBeNull();
  });

  test('setNote after delete revives the row', async () => {
    await using run = await start(acmeSystem, {
      seed: 14,
      host: syncVirtualHost(),
      draws: acmeDraws({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, 'alice');
    await run.apply(addClient, 'bob');

    await run.apply(mutate, 'alice', setNote, { id: 'n1', body: 'first' });
    await run.apply(assertConverged);
    await run.apply(mutate, 'alice', deleteNote, { id: 'n1' });
    await run.apply(assertConverged);
    await expectNoteNotLiveAt(run, 'bob', 'n1');

    await run.apply(mutate, 'alice', setNote, { id: 'n1', body: 'revived' });
    await run.apply(assertConverged);
    await expectLiveNoteAt(run, 'bob', 'n1', { body: 'revived' });
    expect(await readNoteTombstoneAt(run, 'bob', 'n1')).toBeNull();
  });
});
