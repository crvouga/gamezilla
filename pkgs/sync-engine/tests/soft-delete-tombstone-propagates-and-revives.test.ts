import { describe, expect, test } from 'bun:test';
import {
  addClient,
  deleteNote,
  exampleSystem,
  expectInSync,
  expectLiveNoteAt,
  expectNoteNotLiveAt,
  lastMutationOk,
  mutate,
  readNoteTombstoneAt,
  setNote,
} from '@pkgs/sync-engine/sim';

describe('soft delete tombstone propagates and revives', () => {
  test('delete tombstones on peer after converge', async () => {
    await using s = await exampleSystem.run({
      seed: 13,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, 'alice');
    await s.apply(addClient, 'bob');

    await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'x' });
    await expectInSync(s);

    await s.apply(mutate, 'alice', deleteNote, { id: 'n1' });
    expect(await s.read(lastMutationOk, 'alice')).toBe(true);
    await expectInSync(s);

    await expectNoteNotLiveAt(s, 'bob', 'n1');
    expect(await readNoteTombstoneAt(s, 'bob', 'n1')).not.toBeNull();
  });

  test('setNote after delete revives the row', async () => {
    await using s = await exampleSystem.run({
      seed: 14,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, 'alice');
    await s.apply(addClient, 'bob');

    await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'first' });
    await expectInSync(s);
    await s.apply(mutate, 'alice', deleteNote, { id: 'n1' });
    await expectInSync(s);
    await expectNoteNotLiveAt(s, 'bob', 'n1');

    await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'revived' });
    await expectInSync(s);
    await expectLiveNoteAt(s, 'bob', 'n1', { body: 'revived' });
    expect(await readNoteTombstoneAt(s, 'bob', 'n1')).toBeNull();
  });
});
