import { describe, expect, test } from 'bun:test';
import { MAX_QUERY_BATCH } from '@pkgs/sync-engine/shared';
import {
  acmeSystem,
  addClient,
  expectConverged,
  hasSynced,
  subscribeAll,
} from '../apps/acme';

describe('query POST chunking', () => {
  test(
    'more than MAX_QUERY_BATCH active scopes converge without 400',
    async () => {
      await using s = await acmeSystem.script({
        seed: 9401,
        args: {
          clientCount: 0,
        },
      });

      await s.apply(addClient, { id: 'alice' });
      // One batch of MAX_QUERY_BATCH + 1 scopes: the POST must chunk.
      await s.apply(
        subscribeAll,
        'alice',
        'notesByFolder',
        Array.from({ length: MAX_QUERY_BATCH + 1 }, (_, i) => ({
          folderId: `folder-${String(i)}`,
        }))
      );
      expect(await s.observe(hasSynced, 'alice')).toBe(true);
      await expectConverged(s);
    },
    { timeout: 60_000 }
  );
});
