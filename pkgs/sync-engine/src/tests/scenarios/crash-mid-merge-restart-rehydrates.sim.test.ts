import { describe, expect, test } from 'bun:test';
import {
  acmeSystem,
  addClient,
  clientIds,
  crashAt,
  expectConverged,
  mutate,
  restart,
  setNote,
} from '../apps/acme';
import {
  expectLiveNoteAt,
  expectNotesAgree,
  readLiveNoteIds,
} from '../apps/acme/reads';

describe('crash mid merge restart rehydrates', () => {
  test('crash after sync delivery; restart never torn across tables', async () => {
    await using s = await acmeSystem.script({
      seed: 830,
      args: { clientCount: 0, rowImageFanout: false },
    });

    await s.apply(addClient, 'alice');
    await s.apply(addClient, 'bob');

    await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'one' });
    await s.apply(mutate, 'alice', setNote, { id: 'n2', body: 'two' });
    await expectConverged(s);

    await s.apply(crashAt, 'bob', 'afterNextSyncResponseDelivered');
    await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'updated' });
    await s.apply(mutate, 'alice', setNote, { id: 'n3', body: 'three' });
    await s.elapse(800);

    expect(await s.observe(clientIds)).not.toContain('bob');
    await s.apply(restart, 'bob', { preserveLocalDb: true });
    await expectConverged(s);

    const ids = new Set(await readLiveNoteIds(s, 'bob'));
    expect(ids.has('n1')).toBe(true);
    expect(ids.has('n2')).toBe(true);
    await expectLiveNoteAt(s, 'bob', 'n1', { body: 'updated' });
    await expectLiveNoteAt(s, 'bob', 'n3', { body: 'three' });
    await expectNotesAgree(s, 'bob');
  });
});
