import { describe, test } from 'bun:test';
import { start } from '@pkgs/dst';
import {
  acmeDraws,
  acmeSystem,
  addClient,
  assertConverged,
  heal,
  mutate,
  partition,
  passTime,
  setNote,
  syncVirtualHost,
} from '../apps/acme';
import { expectLiveNoteAt, expectNotesAgree } from '../apps/acme/reads';

describe('content reverts hash matches not modified sound', () => {
  test('A→B→A while peer partitioned leaves peer at A after heal', async () => {
    await using run = await start(acmeSystem, {
      seed: 803,
      host: syncVirtualHost(),
      draws: acmeDraws({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, 'alice');
    await run.apply(addClient, 'bob');

    await run.apply(mutate, 'alice', setNote, { id: 'n1', body: 'A' });
    await run.apply(assertConverged);
    await expectLiveNoteAt(run, 'bob', 'n1', { body: 'A' });

    // Full partition so peer never applies intermediate B via live images.
    await run.apply(partition, 'bob', 'all');
    await run.apply(mutate, 'alice', setNote, { id: 'n1', body: 'B' });
    await run.apply(mutate, 'alice', setNote, { id: 'n1', body: 'A' });
    await run.apply(passTime, 100);
    await expectLiveNoteAt(run, 'bob', 'n1', { body: 'A' });

    await run.apply(heal);
    await run.apply(assertConverged);

    await expectLiveNoteAt(run, 'bob', 'n1', { body: 'A' });
    await expectLiveNoteAt(run, 'alice', 'n1', { body: 'A' });
    await expectNotesAgree(run, 'bob');
  });
});
