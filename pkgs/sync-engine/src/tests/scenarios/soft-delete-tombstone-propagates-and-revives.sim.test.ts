import { describe, expect, test } from 'bun:test';
import {
  acmeSystem,
  addClient,
  deleteNote,
  expectConverged,
  lastMutationOk,
  mutate,
  setNote,
} from '../apps/acme';
import {
  expectLiveNoteAt,
  expectNoteNotLiveAt,
  readNoteTombstoneAt,
} from '../apps/acme/reads';

describe('soft delete tombstone propagates and revives', () => {
  test('delete tombstones on peer after converge', async () => {
    await using s = await acmeSystem.script({
      seed: 13,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, 'alice');
    await s.apply(addClient, 'bob');

    await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'x' });
    await expectConverged(s);

    await s.apply(mutate, 'alice', deleteNote, { id: 'n1' });
    expect(await s.observe(lastMutationOk, 'alice')).toBe(true);
    await expectConverged(s);

    await expectNoteNotLiveAt(s, 'bob', 'n1');
    expect(await readNoteTombstoneAt(s, 'bob', 'n1')).not.toBeNull();
  });

  test('setNote after delete revives the row', async () => {
    await using s = await acmeSystem.script({
      seed: 14,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, 'alice');
    await s.apply(addClient, 'bob');

    await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'first' });
    await expectConverged(s);
    await s.apply(mutate, 'alice', deleteNote, { id: 'n1' });
    await expectConverged(s);
    await expectNoteNotLiveAt(s, 'bob', 'n1');

    await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'revived' });
    await expectConverged(s);
    await expectLiveNoteAt(s, 'bob', 'n1', { body: 'revived' });
    expect(await readNoteTombstoneAt(s, 'bob', 'n1')).toBeNull();
  });
});
