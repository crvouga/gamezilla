import { describe, expect, test } from 'bun:test';
import type { Topic } from '@pkgs/pubsub/interface';
import type { MutationDb } from '../../mutations/core/types';
import { defineTopicMap } from '../../shared/topic-map';

const map = defineTopicMap({
  spaces: {
    // topic-map-db: peer user wake when ended_at set
    async topics(row, ctx, db) {
      const id = String(row['id'] ?? '');
      const base: Topic[] = [
        ...(id.length > 0 ? [`room:${id}` as Topic] : []),
        `user:${ctx.actorId}` as Topic,
      ];
      if (row['ended_at'] == null || db === undefined) {
        return [...new Set(base)];
      }
      const party = (await db.query({
        sql: 'SELECT user_id FROM spaces_users',
        params: [],
      } as never)) as readonly { readonly user_id: string }[];
      return [
        ...new Set([
          ...base,
          ...party.map((r) => `user:${r.user_id}` as Topic),
        ]),
      ];
    },
  },
});

describe('createSpace skips party db', () => {
  test('spaces map without ended_at does not query MutationDb', async () => {
    let queries = 0;
    const db = {
      query: async () => {
        queries += 1;
        return [];
      },
      run: async () => ({ changes: 0, lastInsertRowid: 0 }),
    } as unknown as MutationDb;

    const topics = await map['spaces']!.topics(
      { id: 'space-new', ended_at: null },
      {
        actorId: 'alice',
        deviceId: 'd',
        accountId: null,
        isAnon: false,
      },
      db
    );

    expect(queries).toBe(0);
    expect(topics).toContain('room:space-new');
    expect(topics).toContain('user:alice');
  });

  test('spaces map with ended_at loads party via topic-map-db', async () => {
    let queries = 0;
    const db = {
      query: async () => {
        queries += 1;
        return [{ user_id: 'bob' }];
      },
      run: async () => ({ changes: 0, lastInsertRowid: 0 }),
    } as unknown as MutationDb;

    const topics = await map['spaces']!.topics(
      {
        id: 'space-end',
        ended_at: '2026-01-01T00:00:00.000Z',
      },
      {
        actorId: 'alice',
        deviceId: 'd',
        accountId: null,
        isAnon: false,
      },
      db
    );

    expect(queries).toBeGreaterThan(0);
    expect(topics).toContain('user:bob');
  });
});
