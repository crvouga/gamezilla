import { describe, expect, test } from 'bun:test';
import { start } from '@pkgs/dst';
import { MAX_QUERY_BATCH } from '@pkgs/sync-engine/shared';
import {
  acmeKnobs,
  acmeSystem,
  addClient,
  expectConverged,
  hasSynced,
  subscribeAll,
  syncVirtualHost,
} from '../apps/acme';

describe('query POST chunking', () => {
  test(
    'more than MAX_QUERY_BATCH active scopes converge without 400',
    async () => {
      await using run = await start(acmeSystem, {
        seed: 9401,
        host: syncVirtualHost(),
        knobs: acmeKnobs({
          clientCount: 0,
        }),
        properties: [],
      });

      await run.apply(addClient, { id: 'alice' });
      // One batch of MAX_QUERY_BATCH + 1 scopes: the POST must chunk.
      await run.apply(
        subscribeAll,
        'alice',
        'notesByFolder',
        Array.from({ length: MAX_QUERY_BATCH + 1 }, (_, i) => ({
          folderId: `folder-${String(i)}`,
        }))
      );
      expect(await run.observe(hasSynced('alice'))).toBe(true);
      await expectConverged(run);
    },
    { timeout: 60_000 }
  );
});
