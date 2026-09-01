import { describe, expect, test } from 'bun:test';
import { openWorld } from '@pkgs/determinism';
import { expectLiveNote, setFolder, setNote } from '../apps/acme';
import { acmeSystem } from '../apps/acme/system';

describe('scope hash stable under param key order', () => {
  test.each([800, 801, 802])(
    'reordered params share one scope (seed=%i)',
    async (seed) => {
      await using host = await openWorld(acmeSystem, {
        seed: seed,
        knobs: {
          clientCount: 0,
        },
      });
      const world = host.facade;
      const a = await world.addClient({ id: 'alice' });
      await a.mutate(setFolder, { id: 'f1', title: 'Folder' });
      await a.mutate(setNote, {
        id: 'n1',
        body: 'in-folder',
        folderId: 'f1',
      });
      await world.assertConverged();

      const topicsBefore = a.subscribedTopics().length;

      using s1 = a.subscribe('notesByFolder', {
        folderId: 'f1',
        includeArchived: true,
      });
      await world.until(s1.ready);
      const topicsAfterFirst = a.subscribedTopics().length;

      using s2 = a.subscribe('notesByFolder', {
        includeArchived: true,
        folderId: 'f1',
      });
      await world.until(s2.ready);
      const topicsAfterSecond = a.subscribedTopics().length;

      // Same canonical params → no extra topic churn from second subscribe.
      expect(topicsAfterSecond).toBe(topicsAfterFirst);
      expect(topicsAfterFirst).toBeGreaterThanOrEqual(topicsBefore);

      await expectLiveNote(a.db, 'n1', { body: 'in-folder' });
      await world.assertConverged();
    }
  );
});
