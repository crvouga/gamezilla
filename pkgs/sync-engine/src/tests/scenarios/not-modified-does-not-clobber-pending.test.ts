import { describe, expect, test } from 'bun:test';

import { RELIABLE_FAULTS } from '../../sim/faults';
import {
  expectLiveNote,
  expectNotesMatchServer,
  readLiveNotes,
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

describe('not modified does not clobber pending', () => {
  test('not_modified refetch does not clobber pending optimistic; later hash miss rebases', async () => {
    const world = await openSimWorld({ seed: 640, faults: RELIABLE_FAULTS });
    try {
      const a = await world.addClient({ id: 'alice' });
      const b = await world.addClient({ id: 'bob' });

      await a.mutate(setNote, { id: 'n1', body: 'seed' });
      await world.assertConverged();

      // Queue pending without upload (upload loop stopped).
      await a.engine.disconnect();
      await a.mutate(setNote, { id: 'n1', body: 'optimistic-pending' });
      await expectLiveNote(a.db, 'n1', { body: 'optimistic-pending' });
      await expectLiveNote(world.server.db, 'n1', { body: 'seed' });

      // Reconnect: session sync sees unchanged server hash → not_modified;
      // pending mutation rebases on top so optimistic body must survive.
      await a.engine.connect();
      await pump(world, a.engine.waitForFirstSync());
      await expectLiveNote(a.db, 'n1', { body: 'optimistic-pending' });

      await b.mutate(setNote, { id: 'n1', body: 'from-bob' });
      await world.assertConverged();

      await expectNotesMatchServer(a.db, world.server.db);
      await expectNotesMatchServer(b.db, world.server.db);
      expect(
        (await readLiveNotes(world.server.db)).find((r) => r.id === 'n1')
      ).toBeDefined();
    } finally {
      await world.dispose();
    }
  });
});
