import { describe, test } from 'bun:test';
import {
  acmeSystem,
  addClient,
  expectConverged,
  mutate,
  NOTES_AUTH_GATE_FOLDER_ID,
  nudge,
  setFolder,
  setNote,
  subscribe,
} from '../apps/acme';
import { expectLiveNoteAt } from '../apps/acme/reads';

describe('mid session authorize deny keeps domain rows', () => {
  test('ownership flip denies scope; domain rows remain; other scopes sync', async () => {
    await using s = await acmeSystem.script({
      seed: 620,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, 'alice');
    await s.apply(addClient, 'bob');

    await s.apply(mutate, 'alice', setFolder, {
      id: NOTES_AUTH_GATE_FOLDER_ID,
      title: 'gate',
    });
    await s.apply(mutate, 'alice', setNote, {
      id: 'n1',
      body: 'keep-locally',
    });
    await expectConverged(s);

    await s.apply(subscribe, 'alice', 'notesOwned', {});
    await expectLiveNoteAt(s, 'alice', 'n1', { body: 'keep-locally' });

    // Steal gate ownership → next notesOwned refetch is denied.
    await s.apply(mutate, 'bob', setFolder, {
      id: NOTES_AUTH_GATE_FOLDER_ID,
      title: 'stolen',
    });
    await expectConverged(s);

    // Denied detach must not wipe previously hydrated domain rows.
    await s.apply(nudge, 'alice');
    await expectLiveNoteAt(s, 'alice', 'n1', { body: 'keep-locally' });

    await s.apply(mutate, 'bob', setNote, { id: 'n2', body: 'still-syncs' });
    await expectConverged(s);
    await expectLiveNoteAt(s, 'alice', 'n2', { body: 'still-syncs' });
  });
});
