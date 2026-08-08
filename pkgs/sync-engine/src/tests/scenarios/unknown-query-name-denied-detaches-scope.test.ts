import { describe, test } from 'bun:test';
import {
  expectLiveNote,
  expectNotesMatchServer,
  notesDomainPack,
  setNote,
} from '../../domain-packs/notes-app';
import { RELIABLE_FAULTS } from '../../sim/faults';
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

describe('unknown query name denied detaches scope', () => {
  for (const seed of [780, 781, 782]) {
    test(`unknown query denied keeps domain rows (seed=${seed})`, async () => {
      const world = await openSimWorld({
        domain: notesDomainPack,
        seed,
        faults: RELIABLE_FAULTS,
      });
      try {
        const a = await world.addClient({ id: 'alice' });
        await a.mutate(setNote, { id: 'n1', body: 'keep-me' });
        await world.assertConverged();
        await expectLiveNote(a.db, 'n1', { body: 'keep-me' });

        const denied = a.engine.subscribeQuery('noSuchQueryEver', {});
        await pump(world, denied.waitForFirstSync());
        await expectLiveNote(a.db, 'n1', { body: 'keep-me' });
        await expectNotesMatchServer(a.db, world.server.db);

        denied.unsubscribe();
        await pump(world, a.engine.refreshQueries());
        await expectLiveNote(a.db, 'n1', { body: 'keep-me' });
        await world.assertConverged();
      } finally {
        await world.dispose();
      }
    });
  }
});
