import { describe, expect, test } from 'bun:test';
import { start } from '@pkgs/dst';
import {
  acmeDraws,
  acmeSystem,
  addClient,
  converge,
  mutate,
  passTime,
  pendingEventCount,
  schedulerQuiescent,
  setFolder,
  setNote,
  subscribe,
  subscribedTopics,
  syncVirtualHost,
} from '../apps/acme';

describe('scope churn no leaked timers or subscriptions', () => {
  test('rapid subscribe/unsubscribe settles to active session topics only', async () => {
    await using run = await start(acmeSystem, {
      seed: 1030,
      host: syncVirtualHost(),
      draws: acmeDraws({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, { id: 'alice' });
    await run.apply(mutate, 'alice', setFolder, { id: 'f1', title: 'A' });
    await run.apply(mutate, 'alice', setFolder, { id: 'f2', title: 'B' });
    await run.apply(mutate, 'alice', setNote, {
      id: 'n1',
      body: 'x',
      folderId: 'f1',
    });
    await run.apply(converge);

    // Warm held-row topic projection (same path subscribe churn uses).
    await run.apply(subscribe, 'alice', 'notesByFolder', {
      folderId: 'f1',
      includeArchived: false,
    });
    await run.apply(passTime, 200);
    const baseline = [...(await run.observe(subscribedTopics('alice')))].sort();

    for (let i = 0; i < 20; i += 1) {
      await run.apply(subscribe, 'alice', 'notesByFolder', {
        folderId: i % 2 === 0 ? 'f1' : 'f2',
        includeArchived: i % 3 === 0,
      });
    }

    await run.apply(passTime, 1_000);
    expect([...(await run.observe(subscribedTopics('alice')))].sort()).toEqual(
      baseline
    );
    // No runaway timer storm: pending work stays bounded after churn.
    expect(await run.observe(pendingEventCount)).toBeLessThan(50);
    await run.apply(converge);
  });

  test.each([1031, 1032, 1033])(
    'seed sweep churn returns to session topics (seed=%i)',
    async (seed) => {
      await using run = await start(acmeSystem, {
        seed: seed,
        host: syncVirtualHost(),
        draws: acmeDraws({ clientCount: 0 }),
        properties: [],
      });

      await run.apply(addClient, { id: 'alice' });
      const baseline = [
        ...(await run.observe(subscribedTopics('alice'))),
      ].sort();
      for (let i = 0; i < 6; i += 1) {
        await run.apply(subscribe, 'alice', 'notesDenied', {});
      }
      await run.apply(passTime, 500);
      expect(
        [...(await run.observe(subscribedTopics('alice')))].sort()
      ).toEqual(baseline);
      const quiescent = await run.observe(schedulerQuiescent);
      const pending = await run.observe(pendingEventCount);
      expect(quiescent || pending < 50).toBe(true);
    }
  );
});
