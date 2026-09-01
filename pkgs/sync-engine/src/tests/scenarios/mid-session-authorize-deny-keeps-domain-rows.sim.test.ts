import { describe, test } from 'bun:test';
import { openWorld } from '@pkgs/determinism';
import {
  expectLiveNote,
  NOTES_AUTH_GATE_FOLDER_ID,
  setFolder,
  setNote,
} from '../apps/acme';
import { acmeSystem } from '../apps/acme/system';

describe('mid session authorize deny keeps domain rows', () => {
  test('ownership flip denies scope; domain rows remain; other scopes sync', async () => {
    await using host = await openWorld(acmeSystem, {
      seed: 620,
      knobs: {
        clientCount: 0,
      },
    });
    const world = host.facade;
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });

    await a.mutate(setFolder, {
      id: NOTES_AUTH_GATE_FOLDER_ID,
      title: 'gate',
    });
    await a.mutate(setNote, { id: 'n1', body: 'keep-locally' });
    await world.assertConverged();

    using owned = a.subscribe('notesOwned', {});
    await world.until(owned.ready);
    await expectLiveNote(a.db, 'n1', { body: 'keep-locally' });

    // Steal gate ownership → next notesOwned refetch is denied.
    await b.mutate(setFolder, {
      id: NOTES_AUTH_GATE_FOLDER_ID,
      title: 'stolen',
    });
    await world.assertConverged();

    // nudge: denied detach must not wipe previously hydrated domain rows
    await world.until(a.nudge());
    await expectLiveNote(a.db, 'n1', { body: 'keep-locally' });

    await b.mutate(setNote, { id: 'n2', body: 'still-syncs' });
    await world.assertConverged();
    await expectLiveNote(a.db, 'n2', { body: 'still-syncs' });
  });
});
