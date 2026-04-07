import { InMemoryPubSub } from '@gamezilla/shared/pub-sub/impl-in-memory';
import { describe, expect, test } from 'bun:test';
import type { Patch, PatchesDbQuery } from '../interface';
import { createSqliteFactory } from '../test/test-helpers';
import { PatchDbImplSyncHost } from './impl-sync-host';

describe('PatchDbImplSyncHost', () => {
  test('read deduplicates knownPatches shared across queries', async () => {
    const { db, teardown } = await createSqliteFactory();
    try {
      const pubSub = new InMemoryPubSub();
      const host = new PatchDbImplSyncHost(db, pubSub);

      const written = await host.write([
        {
          entityId: 'e1',
          entityType: 'task',
          attributes: { 'task/title': 'A' },
        },
        {
          entityId: 'e1',
          entityType: 'task',
          attributes: { 'task/title': 'B' },
        },
      ]);
      expect(written).toHaveLength(2);

      const sharedKnown: Patch[] = written;
      const q1: PatchesDbQuery = {
        entityType: 'task',
        entityId: 'e1',
        knownPatches: sharedKnown,
      };
      const q2: PatchesDbQuery = {
        entityType: 'task',
        entityId: 'e1',
        knownPatches: sharedKnown,
      };

      const results = await host.read([q1, q2]);
      expect(results).toHaveLength(2);
    } finally {
      await teardown();
    }
  });
});
