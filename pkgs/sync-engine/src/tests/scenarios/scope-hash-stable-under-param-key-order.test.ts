import { describe, expect, test } from 'bun:test';

import { RELIABLE_FAULTS } from '../../sim/faults';
import { expectLiveNote, setFolder, setNote } from '../../sim/notes-app';
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

describe('scope hash stable under param key order', () => {
  for (const seed of [800, 801, 802]) {
    test(`reordered params share one scope (seed=${seed})`, async () => {
      const world = await openSimWorld({ seed, faults: RELIABLE_FAULTS });
      try {
        const a = await world.addClient({ id: 'alice' });
        await a.mutate(setFolder, { id: 'f1', title: 'Folder' });
        await a.mutate(setNote, {
          id: 'n1',
          body: 'in-folder',
          folderId: 'f1',
        });
        await world.assertConverged();

        const topicsBefore = a.subscribedTopics().length;

        const s1 = a.engine.subscribeQuery('notesByFolder', {
          folderId: 'f1',
          includeArchived: true,
        });
        await pump(world, s1.waitForFirstSync());
        const topicsAfterFirst = a.subscribedTopics().length;

        const s2 = a.engine.subscribeQuery('notesByFolder', {
          includeArchived: true,
          folderId: 'f1',
        });
        await pump(world, s2.waitForFirstSync());
        const topicsAfterSecond = a.subscribedTopics().length;

        // Same canonical params → no extra topic churn from second subscribe.
        expect(topicsAfterSecond).toBe(topicsAfterFirst);
        expect(topicsAfterFirst).toBeGreaterThanOrEqual(topicsBefore);

        await expectLiveNote(a.db, 'n1', { body: 'in-folder' });
        s1.unsubscribe();
        s2.unsubscribe();
        await world.assertConverged();
      } finally {
        await world.dispose();
      }
    });
  }
});
