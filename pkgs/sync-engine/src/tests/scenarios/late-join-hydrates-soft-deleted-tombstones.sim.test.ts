import { describe, expect, test } from 'bun:test';
import {
  acmeSystem,
  addClient,
  deleteNote,
  expectConverged,
  expectNoteNotLiveAt,
  mutate,
  readNoteTombstoneAt,
  setNote,
} from '../apps/acme';

describe('late join hydrates soft deleted tombstones', () => {
  test('peer that joins after delete gets tombstone from snapshot', async () => {
    await using s = await acmeSystem.script({
      seed: 511,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, 'alice');
    await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'gone' });
    await expectConverged(s);
    await s.apply(mutate, 'alice', deleteNote, { id: 'n1' });
    await expectConverged(s);

    await s.apply(addClient, 'charlie');
    await expectNoteNotLiveAt(s, 'charlie', 'n1');
    const tomb = await readNoteTombstoneAt(s, 'charlie', 'n1');
    expect(tomb).not.toBeNull();
  });
});
