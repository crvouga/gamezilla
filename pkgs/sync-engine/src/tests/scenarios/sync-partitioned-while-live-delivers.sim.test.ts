import { describe, test } from 'bun:test';
import {
  acmeSystem,
  addClient,
  expectConverged,
  heal,
  mutate,
  partition,
  setNote,
} from '../apps/acme';
import { expectLiveNoteAt, expectNotesAgree } from '../apps/acme/reads';

describe('sync partitioned while live delivers', () => {
  test('partition sync then heal converges', async () => {
    await using s = await acmeSystem.script({
      seed: 506,
      args: { clientCount: 0, rowImageFanout: false },
    });

    await s.apply(addClient, 'alice');
    await s.apply(addClient, 'bob');
    await s.apply(mutate, 'alice', setNote, { id: 'warm', body: 'w' });
    await expectConverged(s);

    await s.apply(partition, 'bob', 'sync');
    await s.apply(mutate, 'alice', setNote, {
      id: 'n1',
      body: 'sync-partitioned',
    });
    await s.elapse(100);

    await s.apply(heal);
    await expectConverged(s);
    await expectLiveNoteAt(s, 'bob', 'n1', { body: 'sync-partitioned' });
    await expectNotesAgree(s, 'bob');
  });
});
