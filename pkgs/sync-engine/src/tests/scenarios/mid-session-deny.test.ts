import { describe, test } from 'bun:test';

import { RELIABLE_FAULTS } from '../../sim/faults';
import {
  expectLiveNote,
  NOTES_AUTH_GATE_FOLDER_ID,
  setFolder,
  setNote,
} from '../../sim/notes-app';
import { openSimWorld, type SimWorld } from '../../sim/world';

async function pump(
  world: SimWorld,
  work: Promise<unknown>,
  maxVirtualMs = 2_000
): Promise<void> {
  let done = false;
  const tracked = Promise.resolve(work).finally(() => {
    done = true;
  });
  const steps = Math.ceil(maxVirtualMs / 25);
  for (let i = 0; i < steps && !done; i += 1) {
    await world.runFor(25);
  }
  await tracked;
}

describe('mid session deny', () => {
  test('ownership flip denies scope; domain rows remain; other scopes sync', async () => {
    const world = await openSimWorld({ seed: 620, faults: RELIABLE_FAULTS });
    try {
      const a = await world.addClient({ id: 'alice' });
      const b = await world.addClient({ id: 'bob' });

      await a.mutate(setFolder, {
        id: NOTES_AUTH_GATE_FOLDER_ID,
        title: 'gate',
      });
      await a.mutate(setNote, { id: 'n1', body: 'keep-locally' });
      await world.assertConverged();

      const owned = a.engine.subscribeQuery('notesOwned', {});
      await pump(world, owned.waitForFirstSync());
      await expectLiveNote(a.db, 'n1', { body: 'keep-locally' });

      // Steal gate ownership → next notesOwned refetch is denied.
      await b.mutate(setFolder, {
        id: NOTES_AUTH_GATE_FOLDER_ID,
        title: 'stolen',
      });
      await world.assertConverged();

      await pump(world, a.engine.refreshQueries());
      // Denied detach must not wipe previously hydrated domain rows.
      await expectLiveNote(a.db, 'n1', { body: 'keep-locally' });

      await b.mutate(setNote, { id: 'n2', body: 'still-syncs' });
      await world.assertConverged();
      await expectLiveNote(a.db, 'n2', { body: 'still-syncs' });

      owned.unsubscribe();
    } finally {
      await world.dispose();
    }
  });
});
