import { describe, expect, test } from 'bun:test';
import { start } from '@pkgs/dst';
import {
  acmeDraws,
  acmeSystem,
  addClient,
  expectConverged,
  liveNote,
  mutate,
  setFolder,
  setNote,
  subscribe,
  subscribedTopics,
  syncVirtualHost,
} from '../apps/acme';

describe('scope hash stable under param key order', () => {
  test.each([800, 801, 802])(
    'reordered params share one scope (seed=%i)',
    async (seed) => {
      await using run = await start(acmeSystem, {
        seed: seed,
        host: syncVirtualHost(),
        draws: acmeDraws({ clientCount: 0 }),
        properties: [],
      });

      await run.apply(addClient, { id: 'alice' });
      await run.apply(mutate, 'alice', setFolder, {
        id: 'f1',
        title: 'Folder',
      });
      await run.apply(mutate, 'alice', setNote, {
        id: 'n1',
        body: 'in-folder',
        folderId: 'f1',
      });
      await expectConverged(run);

      const topicsBefore = (await run.observe(subscribedTopics('alice')))
        .length;

      await run.apply(subscribe, 'alice', 'notesByFolder', {
        folderId: 'f1',
        includeArchived: true,
      });
      const topicsAfterFirst = (await run.observe(subscribedTopics('alice')))
        .length;

      await run.apply(subscribe, 'alice', 'notesByFolder', {
        includeArchived: true,
        folderId: 'f1',
      });
      const topicsAfterSecond = (await run.observe(subscribedTopics('alice')))
        .length;

      // Same canonical params → no extra topic churn from second subscribe.
      expect(topicsAfterSecond).toBe(topicsAfterFirst);
      expect(topicsAfterFirst).toBeGreaterThanOrEqual(topicsBefore);

      expect(await run.observe(liveNote('alice', 'n1'))).toMatchObject({
        body: 'in-folder',
      });
      await expectConverged(run);
    }
  );
});
