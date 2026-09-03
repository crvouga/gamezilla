import { describe, expect, test } from 'bun:test';
import { script } from '@pkgs/dst';
import {
  acmeKnobs,
  acmeSystem,
  addClient,
  clientIds,
  crashAt,
  expectConverged,
  mutate,
  passTime,
  restart,
  setNote,
  syncVirtualHost,
} from '../apps/acme';
import {
  expectLiveNoteAt,
  expectNotesAgree,
  readLiveNoteIds,
} from '../apps/acme/reads';

describe('crash mid merge restart rehydrates', () => {
  test('crash after sync delivery; restart never torn across tables', async () => {
    await using run = await script(acmeSystem, {
      seed: 830,
      host: syncVirtualHost(),
      knobs: acmeKnobs({ clientCount: 0, rowImageFanout: false }),
      properties: [],
    });

    await run.apply(addClient, 'alice');
    await run.apply(addClient, 'bob');

    await run.apply(mutate, 'alice', setNote, { id: 'n1', body: 'one' });
    await run.apply(mutate, 'alice', setNote, { id: 'n2', body: 'two' });
    await expectConverged(run);

    await run.apply(crashAt, 'bob', 'afterNextSyncResponseDelivered');
    await run.apply(mutate, 'alice', setNote, { id: 'n1', body: 'updated' });
    await run.apply(mutate, 'alice', setNote, { id: 'n3', body: 'three' });
    await run.apply(passTime, 800);

    expect(await run.observe(clientIds)).not.toContain('bob');
    await run.apply(restart, 'bob', { preserveLocalDb: true });
    await expectConverged(run);

    const ids = new Set(await readLiveNoteIds(run, 'bob'));
    expect(ids.has('n1')).toBe(true);
    expect(ids.has('n2')).toBe(true);
    await expectLiveNoteAt(run, 'bob', 'n1', { body: 'updated' });
    await expectLiveNoteAt(run, 'bob', 'n3', { body: 'three' });
    await expectNotesAgree(run, 'bob');
  });
});
