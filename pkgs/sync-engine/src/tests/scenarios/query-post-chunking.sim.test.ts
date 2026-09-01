import { describe, expect, test } from 'bun:test';
import { openWorld } from '@pkgs/determinism';
import { MAX_QUERY_BATCH } from '@pkgs/sync-engine/shared';
import { syncFacade } from '../../sim/system';
import { acmeSystem } from '../apps/acme/system';

describe('query POST chunking', () => {
  test(
    'more than MAX_QUERY_BATCH active scopes converge without 400',
    async () => {
      await using host = await openWorld(acmeSystem, {
        seed: 9401,
        knobs: {
          clientCount: 0,
        },
      });
      const world = syncFacade(host.system);
      const client = await world.addClient({ id: 'alice' });
      const subs = [];
      for (let i = 0; i < MAX_QUERY_BATCH + 1; i += 1) {
        subs.push(
          client.subscribe('notesByFolder', { folderId: `folder-${i}` })
        );
      }
      for (const sub of subs) {
        await world.until(sub.ready, { budgetMs: 5_000 });
      }
      expect(client.hasSynced()).toBe(true);
      await world.assertConverged();
    },
    { timeout: 60_000 }
  );
});
