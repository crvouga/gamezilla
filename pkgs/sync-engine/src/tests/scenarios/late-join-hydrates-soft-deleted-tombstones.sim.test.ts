import { describe, expect, test } from 'bun:test';
import { start } from '@pkgs/dst';
import {
  acmeKnobs,
  acmeSystem,
  addClient,
  deleteNote,
  expectConverged,
  expectNoteNotLiveAt,
  mutate,
  readNoteTombstoneAt,
  setNote,
  syncVirtualHost,
} from '../apps/acme';

describe('late join hydrates soft deleted tombstones', () => {
  test('peer that joins after delete gets tombstone from snapshot', async () => {
    await using run = await start(acmeSystem, {
      seed: 511,
      host: syncVirtualHost(),
      knobs: acmeKnobs({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, 'alice');
    await run.apply(mutate, 'alice', setNote, { id: 'n1', body: 'gone' });
    await expectConverged(run);
    await run.apply(mutate, 'alice', deleteNote, { id: 'n1' });
    await expectConverged(run);

    await run.apply(addClient, 'charlie');
    await expectNoteNotLiveAt(run, 'charlie', 'n1');
    const tomb = await readNoteTombstoneAt(run, 'charlie', 'n1');
    expect(tomb).not.toBeNull();
  });
});
