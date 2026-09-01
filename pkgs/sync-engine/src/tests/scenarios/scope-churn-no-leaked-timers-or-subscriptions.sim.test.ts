import { describe, expect, test } from 'bun:test';
import { openWorld } from '@pkgs/determinism';
import { syncFacade } from '../../sim/system';
import { setFolder, setNote } from '../apps/acme';
import { acmeSystem } from '../apps/acme/system';

describe('scope churn no leaked timers or subscriptions', () => {
  test('rapid subscribe/unsubscribe settles to active session topics only', async () => {
    await using host = await openWorld(acmeSystem, {
      seed: 1030,
      knobs: {
        clientCount: 0,
      },
    });
    const world = syncFacade(host.system);
    const a = await world.addClient({ id: 'alice' });
    await a.mutate(setFolder, { id: 'f1', title: 'A' });
    await a.mutate(setFolder, { id: 'f2', title: 'B' });
    await a.mutate(setNote, { id: 'n1', body: 'x', folderId: 'f1' });
    await world.assertConverged();

    // Warm held-row topic projection (same path subscribe churn uses).
    {
      using warm = a.subscribe('notesByFolder', {
        folderId: 'f1',
        includeArchived: false,
      });
      await world.until(warm.ready, { budgetMs: 1_000 });
    }
    await world.runFor(200);
    const baseline = [...a.subscribedTopics()].sort();

    for (let i = 0; i < 20; i += 1) {
      const folderId = i % 2 === 0 ? 'f1' : 'f2';
      using sub = a.subscribe('notesByFolder', {
        folderId,
        includeArchived: i % 3 === 0,
      });
      await world.until(sub.ready, { budgetMs: 1_000 });
    }

    await world.runFor(1_000);
    expect([...a.subscribedTopics()].sort()).toEqual(baseline);
    // No runaway timer storm: pending work stays bounded after churn.
    expect(world.pendingEventCount()).toBeLessThan(50);
    await world.assertConverged();
  });

  test.each([1031, 1032, 1033])(
    'seed sweep churn returns to session topics (seed=%i)',
    async (seed) => {
      await using host = await openWorld(acmeSystem, {
        seed: seed,
        knobs: {
          clientCount: 0,
        },
      });
      const world = syncFacade(host.system);
      const a = await world.addClient({ id: 'alice' });
      const baseline = [...a.subscribedTopics()].sort();
      for (let i = 0; i < 6; i += 1) {
        using sub = a.subscribe('notesDenied', {});
        await world.until(sub.ready, { budgetMs: 800 });
      }
      await world.runFor(500);
      expect([...a.subscribedTopics()].sort()).toEqual(baseline);
      expect(
        world.isSchedulerQuiescent() || world.pendingEventCount() < 50
      ).toBe(true);
    }
  );
});
