import { describe, test } from 'bun:test';
import {
  expectLiveNote,
  expectNoteNotLive,
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

describe('pubsub publish fails after commit heals by refetch', () => {
  // Pins Consistency table “Push lost”: commit acks, fanout drop, heal via refetch.
  test('lost publish leaves peers stale until foreground refetch', async () => {
    // rowImageFanout false: isolate server publish loss (no optimistic images).
    const world = await openSimWorld({
      domain: notesDomainPack,
      seed: 901,
      faults: RELIABLE_FAULTS,
      rowImageFanout: false,
    });
    try {
      const a = await world.addClient({ id: 'alice' });
      const b = await world.addClient({ id: 'bob' });
      await a.mutate(setNote, { id: 'warm', body: 'w' });
      await world.assertConverged();

      world.hold('bob', 'sync');
      world.armPublishFault('next');
      await a.mutate(setNote, { id: 'n-lost-push', body: 'committed' });
      await world.runFor(400);

      await expectLiveNote(world.server.db, 'n-lost-push', {
        body: 'committed',
      });
      await expectNoteNotLive(b.db, 'n-lost-push');

      world.release('bob', 'sync');
      b.lifecycle.setForeground(false);
      b.lifecycle.setForeground(true);
      await pump(world, b.engine.refreshQueries());
      await world.assertConverged();
      await expectLiveNote(b.db, 'n-lost-push', { body: 'committed' });
    } finally {
      await world.dispose();
    }
  });

  test('seed sweep: publish fault then reconnect heals', async () => {
    for (const seed of [902, 903, 904] as const) {
      const world = await openSimWorld({
        domain: notesDomainPack,
        seed,
        faults: RELIABLE_FAULTS,
        rowImageFanout: false,
      });
      try {
        const a = await world.addClient({ id: 'alice' });
        const b = await world.addClient({ id: 'bob' });
        world.armPublishFault('next');
        await a.mutate(setNote, {
          id: `n-${seed}`,
          body: `b-${seed}`,
        });
        await world.runFor(200);
        await b.engine.disconnect();
        await b.engine.connect();
        await pump(world, b.engine.waitForFirstSync());
        await world.assertConverged();
        await expectLiveNote(b.db, `n-${seed}`, { body: `b-${seed}` });
      } finally {
        await world.dispose();
      }
    }
  });
});
