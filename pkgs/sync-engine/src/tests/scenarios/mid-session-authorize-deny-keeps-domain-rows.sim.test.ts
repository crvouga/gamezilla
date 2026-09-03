import { describe, test } from 'bun:test';
import { start } from '@pkgs/dst';
import {
  acmeKnobs,
  acmeSystem,
  addClient,
  expectConverged,
  mutate,
  NOTES_AUTH_GATE_FOLDER_ID,
  nudge,
  setFolder,
  setNote,
  subscribe,
  syncVirtualHost,
} from '../apps/acme';
import { expectLiveNoteAt } from '../apps/acme/reads';

describe('mid session authorize deny keeps domain rows', () => {
  test('ownership flip denies scope; domain rows remain; other scopes sync', async () => {
    await using run = await start(acmeSystem, {
      seed: 620,
      host: syncVirtualHost(),
      knobs: acmeKnobs({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, 'alice');
    await run.apply(addClient, 'bob');

    await run.apply(mutate, 'alice', setFolder, {
      id: NOTES_AUTH_GATE_FOLDER_ID,
      title: 'gate',
    });
    await run.apply(mutate, 'alice', setNote, {
      id: 'n1',
      body: 'keep-locally',
    });
    await expectConverged(run);

    await run.apply(subscribe, 'alice', 'notesOwned', {});
    await expectLiveNoteAt(run, 'alice', 'n1', { body: 'keep-locally' });

    // Steal gate ownership → next notesOwned refetch is denied.
    await run.apply(mutate, 'bob', setFolder, {
      id: NOTES_AUTH_GATE_FOLDER_ID,
      title: 'stolen',
    });
    await expectConverged(run);

    // Denied detach must not wipe previously hydrated domain rows.
    await run.apply(nudge, 'alice');
    await expectLiveNoteAt(run, 'alice', 'n1', { body: 'keep-locally' });

    await run.apply(mutate, 'bob', setNote, { id: 'n2', body: 'still-syncs' });
    await expectConverged(run);
    await expectLiveNoteAt(run, 'alice', 'n2', { body: 'still-syncs' });
  });
});
