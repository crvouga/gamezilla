import { describe, expect, test } from 'bun:test';
import { start } from '@pkgs/dst';
import {
  acmeKnobs,
  acmeSystem,
  addClient,
  expectConverged,
  mutate,
  setNote,
  syncVirtualHost,
} from '../apps/acme';
import { expectLiveNoteAt, isNoteLiveAt } from '../apps/acme/reads';

describe('entry channel wakes never-held row', () => {
  test('entryChannel delivers peer create before local ever held the row', async () => {
    await using run = await start(acmeSystem, {
      seed: 1220,
      host: syncVirtualHost(),
      knobs: acmeKnobs({ clientCount: 0 }),
      properties: [],
    });

    // notesAll entryChannel = NOTES_ALL_TOPIC (no prior row for n-fresh).
    await run.apply(addClient, 'alice');
    await run.apply(addClient, 'bob');

    expect(await isNoteLiveAt(run, 'bob', 'n-fresh')).toBe(false);

    await run.apply(mutate, 'alice', setNote, {
      id: 'n-fresh',
      body: 'via-entry',
    });
    await expectConverged(run);

    await expectLiveNoteAt(run, 'bob', 'n-fresh', { body: 'via-entry' });
  });
});
