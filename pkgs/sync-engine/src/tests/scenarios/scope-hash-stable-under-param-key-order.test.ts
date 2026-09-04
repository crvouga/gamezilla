import { describe, expect, test } from 'bun:test';
import {
  acmeSystem,
  addClient,
  expectConverged,
  liveNote,
  mutate,
  setFolder,
  setNote,
  subscribe,
  subscribedTopics,
} from '../apps/acme';

describe('scope hash stable under param key order', () => {
  test.each([800, 801, 802])(
    'reordered params share one scope (seed=%i)',
    async (seed) => {
      await using s = await acmeSystem.script({
        seed: seed,
        args: { clientCount: 0 },
      });

      await s.apply(addClient, { id: 'alice' });
      await s.apply(mutate, 'alice', setFolder, {
        id: 'f1',
        title: 'Folder',
      });
      await s.apply(mutate, 'alice', setNote, {
        id: 'n1',
        body: 'in-folder',
        folderId: 'f1',
      });
      await expectConverged(s);

      const topicsBefore = (await s.observe(subscribedTopics, 'alice')).length;

      await s.apply(subscribe, 'alice', 'notesByFolder', {
        folderId: 'f1',
        includeArchived: true,
      });
      const topicsAfterFirst = (await s.observe(subscribedTopics, 'alice'))
        .length;

      await s.apply(subscribe, 'alice', 'notesByFolder', {
        includeArchived: true,
        folderId: 'f1',
      });
      const topicsAfterSecond = (await s.observe(subscribedTopics, 'alice'))
        .length;

      // Same canonical params → no extra topic churn from second subscribe.
      expect(topicsAfterSecond).toBe(topicsAfterFirst);
      expect(topicsAfterFirst).toBeGreaterThanOrEqual(topicsBefore);

      expect(await s.observe(liveNote, 'alice', 'n1')).toMatchObject({
        body: 'in-folder',
      });
      await expectConverged(s);
    }
  );
});
