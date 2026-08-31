import { describe, expect, test } from 'bun:test';
import { MAX_QUERY_BATCH } from '@pkgs/sync-engine/shared';

import { openWorld } from '../../sim/world';
import { acmeDomainPack } from '../apps/acme';

describe('query POST chunking', () => {
  test(
    'more than MAX_QUERY_BATCH active scopes converge without 400',
    async () => {
      await using world = await openWorld({
        domain: acmeDomainPack,
        seed: 9401,
      });
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
