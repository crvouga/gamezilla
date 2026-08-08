import { describe, test } from 'bun:test';

import { RELIABLE_FAULTS } from '../../sim/faults';
import {
  expectLiveNote,
  expectNoteNotLive,
  setNoteWrongTopic,
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

describe('wrong invalidates topic heals on refetch', () => {
  // Companion to channel-exhaustiveness: wrong invalidates ⇒ silent staleness.
  test('peer stays stale until explicit refetch after wrong topic invalidate', async () => {
    const world = await openSimWorld({
      seed: 1080,
      faults: RELIABLE_FAULTS,
      rowImageFanout: false,
    });
    try {
      const a = await world.addClient({ id: 'alice' });
      const b = await world.addClient({ id: 'bob' });
      await a.mutate(setNoteWrongTopic, { id: 'warm', body: 'w' });
      await pump(world, b.engine.refreshQueries());
      await expectLiveNote(b.db, 'warm', { body: 'w' });

      world.hold('bob', 'sync');
      await a.mutate(setNoteWrongTopic, {
        id: 'stale-until-refetch',
        body: 'missed-live',
      });
      await world.runFor(400);
      await expectLiveNote(world.server.db, 'stale-until-refetch', {
        body: 'missed-live',
      });
      await expectNoteNotLive(b.db, 'stale-until-refetch');

      world.release('bob', 'sync');
      await pump(world, b.engine.refreshQueries());
      await world.assertConverged();
      await expectLiveNote(b.db, 'stale-until-refetch', {
        body: 'missed-live',
      });
    } finally {
      await world.dispose();
    }
  });

  test('seed sweep wrong topic heals via refresh', async () => {
    for (const seed of [1081, 1082, 1083] as const) {
      const world = await openSimWorld({
        seed,
        faults: RELIABLE_FAULTS,
        rowImageFanout: false,
      });
      try {
        const a = await world.addClient({ id: 'alice' });
        const b = await world.addClient({ id: 'bob' });
        await a.mutate(setNoteWrongTopic, {
          id: `n-${seed}`,
          body: `b-${seed}`,
        });
        await pump(world, b.engine.refreshQueries());
        await world.assertConverged();
        await expectLiveNote(b.db, `n-${seed}`, { body: `b-${seed}` });
      } finally {
        await world.dispose();
      }
    }
  });
});
