import { describe, expect, test } from 'bun:test';
import {
  acmeSystem,
  addClient,
  expectConverged,
  mutate,
  pendingEventCount,
  schedulerQuiescent,
  setFolder,
  setNote,
  subscribe,
  subscribedTopics,
} from '../apps/acme';

describe('scope churn no leaked timers or subscriptions', () => {
  test('rapid subscribe/unsubscribe settles to active session topics only', async () => {
    await using s = await acmeSystem.script({
      seed: 1030,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, { id: 'alice' });
    await s.apply(mutate, 'alice', setFolder, { id: 'f1', title: 'A' });
    await s.apply(mutate, 'alice', setFolder, { id: 'f2', title: 'B' });
    await s.apply(mutate, 'alice', setNote, {
      id: 'n1',
      body: 'x',
      folderId: 'f1',
    });
    await expectConverged(s);

    // Warm held-row topic projection (same path subscribe churn uses).
    await s.apply(subscribe, 'alice', 'notesByFolder', {
      folderId: 'f1',
      includeArchived: false,
    });
    await s.elapse(200);
    const baseline = [...(await s.observe(subscribedTopics, 'alice'))].sort();

    for (let i = 0; i < 20; i += 1) {
      await s.apply(subscribe, 'alice', 'notesByFolder', {
        folderId: i % 2 === 0 ? 'f1' : 'f2',
        includeArchived: i % 3 === 0,
      });
    }

    await s.elapse(1_000);
    expect([...(await s.observe(subscribedTopics, 'alice'))].sort()).toEqual(
      baseline
    );
    // No runaway timer storm: pending work stays bounded after churn.
    expect(await s.observe(pendingEventCount)).toBeLessThan(50);
    await expectConverged(s);
  });

  test.each([1031, 1032, 1033])(
    'seed sweep churn returns to session topics (seed=%i)',
    async (seed) => {
      await using s = await acmeSystem.script({
        seed: seed,
        args: { clientCount: 0 },
      });

      await s.apply(addClient, { id: 'alice' });
      const baseline = [...(await s.observe(subscribedTopics, 'alice'))].sort();
      for (let i = 0; i < 6; i += 1) {
        await s.apply(subscribe, 'alice', 'notesDenied', {});
      }
      await s.elapse(500);
      expect([...(await s.observe(subscribedTopics, 'alice'))].sort()).toEqual(
        baseline
      );
      const quiescent = await s.observe(schedulerQuiescent);
      const pending = await s.observe(pendingEventCount);
      expect(quiescent || pending < 50).toBe(true);
    }
  );
});
