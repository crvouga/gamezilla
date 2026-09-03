import { describe, test } from 'bun:test';
import { start } from '@pkgs/dst';
import {
  acmeKnobs,
  acmeSystem,
  addClient,
  expectConverged,
  heal,
  mutate,
  partition,
  passTime,
  setNote,
  syncVirtualHost,
} from '../apps/acme';
import { expectLiveNoteAt, expectNotesAgree } from '../apps/acme/reads';

describe('sync partitioned while live delivers', () => {
  test('partition sync then heal converges', async () => {
    await using run = await start(acmeSystem, {
      seed: 506,
      host: syncVirtualHost(),
      knobs: acmeKnobs({ clientCount: 0, rowImageFanout: false }),
      properties: [],
    });

    await run.apply(addClient, 'alice');
    await run.apply(addClient, 'bob');
    await run.apply(mutate, 'alice', setNote, { id: 'warm', body: 'w' });
    await expectConverged(run);

    await run.apply(partition, 'bob', 'sync');
    await run.apply(mutate, 'alice', setNote, {
      id: 'n1',
      body: 'sync-partitioned',
    });
    await run.apply(passTime, 100);

    await run.apply(heal);
    await expectConverged(run);
    await expectLiveNoteAt(run, 'bob', 'n1', { body: 'sync-partitioned' });
    await expectNotesAgree(run, 'bob');
  });
});
