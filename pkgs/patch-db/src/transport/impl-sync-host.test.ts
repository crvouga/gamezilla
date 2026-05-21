import { InMemoryPubSub } from '@pkgs/pub-sub/impl-in-memory';
import { describe, expect, test } from 'bun:test';
import type { PatchDbQuery } from '../interface';
import { toAttributeState } from '../interface';
import { createSqliteFactory } from '../test/test-helpers';
import { PatchDbImplSyncHost } from './impl-sync-host';

describe('PatchDbImplSyncHost', () => {
  test('read returns results matching queries', async () => {
    const { db, teardown } = await createSqliteFactory();
    try {
      const pubSub = new InMemoryPubSub();
      const host = new PatchDbImplSyncHost(db, pubSub);

      await host.write([
        {
          entityId: 'e1',
          entityType: 'task',
          attributes: toAttributeState({ 'task/title': 'A' }),
        },
        {
          entityId: 'e1',
          entityType: 'task',
          attributes: toAttributeState({ 'task/title': 'B' }),
        },
      ]);

      const q1: PatchDbQuery = { entityType: 'task', entityId: 'e1' };
      const q2: PatchDbQuery = { entityType: 'task', entityId: 'e1' };

      const results = await host.read([q1, q2]);
      expect(results).toHaveLength(2);
      expect(results[0]!.patches).toHaveLength(2);
      expect(results[1]!.patches).toHaveLength(2);
    } finally {
      await teardown();
    }
  });
});
