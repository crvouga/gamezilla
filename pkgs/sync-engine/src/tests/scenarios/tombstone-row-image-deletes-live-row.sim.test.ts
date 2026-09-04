import { describe, expect, test } from 'bun:test';
import {
  acmeSystem,
  addClient,
  deleteNote,
  expectConverged,
  expectLiveNoteAt,
  expectNoteNotLiveAt,
  lastMutationOk,
  mutate,
  net,
  readNoteTombstoneAt,
  setNote,
} from '../apps/acme';

describe('tombstone row image deletes live row', () => {
  test('delete row image removes live peer row without waiting on sync', async () => {
    await using s = await acmeSystem.script({
      seed: 806,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, { id: 'alice' });
    await s.apply(addClient, { id: 'bob' });

    await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'alive' });
    await expectConverged(s);
    await expectLiveNoteAt(s, 'bob', 'n1', { body: 'alive' });

    await s.apply(net, 'bob', 'sync', 'hold');
    await s.apply(mutate, 'alice', deleteNote, { id: 'n1' });
    expect(await s.observe(lastMutationOk, 'alice')).toBe(true);
    await s.elapse(300);

    await expectNoteNotLiveAt(s, 'bob', 'n1');
    expect(await readNoteTombstoneAt(s, 'bob', 'n1')).not.toBeNull();

    await expectConverged(s);
    await expectNoteNotLiveAt(s, 'bob', 'n1');
  });
});
