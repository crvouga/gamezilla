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

describe('content reverts hash matches not modified sound', () => {
  test('A→B→A while peer partitioned leaves peer at A after heal', async () => {
    await using s = await acmeSystem.script({
      seed: 803,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, 'alice');
    await s.apply(addClient, 'bob');

    await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'A' });
    await expectConverged(s);
    await expectLiveNoteAt(s, 'bob', 'n1', { body: 'A' });

    // Full partition so peer never applies intermediate B via live images.
    await s.apply(partition, 'bob', 'all');
    await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'B' });
    await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'A' });
    await s.elapse(100);
    await expectLiveNoteAt(s, 'bob', 'n1', { body: 'A' });

    await s.apply(heal);
    await expectConverged(s);

    await expectLiveNoteAt(s, 'bob', 'n1', { body: 'A' });
    await expectLiveNoteAt(s, 'alice', 'n1', { body: 'A' });
    await expectNotesAgree(s, 'bob');
  });
});
