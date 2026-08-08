import { describe, expect, test } from 'bun:test';

import { RELIABLE_FAULTS } from '../../sim/faults';
import { setFolder, setNote } from '../../sim/notes-app';
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

describe('scope churn no leaked timers or subscriptions', () => {
  test('rapid subscribe/unsubscribe settles to active session topics only', async () => {
    const world = await openSimWorld({ seed: 1030, faults: RELIABLE_FAULTS });
    try {
      const a = await world.addClient({ id: 'alice' });
      await a.mutate(setFolder, { id: 'f1', title: 'A' });
      await a.mutate(setFolder, { id: 'f2', title: 'B' });
      await a.mutate(setNote, { id: 'n1', body: 'x', folderId: 'f1' });
      await world.assertConverged();

      const baseline = [...a.subscribedTopics()].sort();
      for (let i = 0; i < 20; i += 1) {
        const folderId = i % 2 === 0 ? 'f1' : 'f2';
        const sub = a.engine.subscribeQuery('notesByFolder', {
          folderId,
          includeArchived: i % 3 === 0,
        });
        await pump(world, sub.waitForFirstSync(), 1_000);
        sub.unsubscribe();
      }

      await world.runFor(1_000);
      expect([...a.subscribedTopics()].sort()).toEqual(baseline);
      // No runaway timer storm: pending work stays bounded after churn.
      expect(world.scheduler.pendingCount()).toBeLessThan(50);
      await world.assertConverged();
    } finally {
      await world.dispose();
    }
  });

  test('seed sweep churn returns to session topics', async () => {
    for (const seed of [1031, 1032, 1033] as const) {
      const world = await openSimWorld({ seed, faults: RELIABLE_FAULTS });
      try {
        const a = await world.addClient({ id: 'alice' });
        const baseline = [...a.subscribedTopics()].sort();
        for (let i = 0; i < 6; i += 1) {
          const sub = a.engine.subscribeQuery('notesDenied', {});
          await pump(world, sub.waitForFirstSync(), 800);
          sub.unsubscribe();
        }
        await world.runFor(500);
        expect([...a.subscribedTopics()].sort()).toEqual(baseline);
        expect(
          world.isSchedulerQuiescent() || world.scheduler.pendingCount() < 50
        ).toBe(true);
      } finally {
        await world.dispose();
      }
    }
  });
});
