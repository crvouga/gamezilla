import { describe, expect, test } from 'bun:test';
import { notesTopicMap, userTopic } from '../../domain-packs/notes-app';
import type { MutationDb } from '../../mutations/core/types';

describe('friend space topic map wakes peers', () => {
  test('live space owned by alice wakes friend bob via topic-map-db', async () => {
    let queries = 0;
    const db = {
      query: async () => {
        queries += 1;
        return [{ user_low: 'alice', user_high: 'bob' }];
      },
      run: async () => ({ changes: 0, lastInsertRowid: 0 }),
    } as unknown as MutationDb;

    const topics = await notesTopicMap['spaces']!.topics(
      {
        id: 'friend-space',
        owner_id: 'alice',
        deleted_at: null,
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
    expect(topics).toContain(userTopic('alice'));
    expect(topics).toContain(userTopic('bob'));
  });

  test('tombstoned space skips friend db lookup', async () => {
    let queries = 0;
    const db = {
      query: async () => {
        queries += 1;
        return [{ user_low: 'alice', user_high: 'bob' }];
      },
      run: async () => ({ changes: 0, lastInsertRowid: 0 }),
    } as unknown as MutationDb;

    const topics = await notesTopicMap['spaces']!.topics(
      {
        id: 'friend-space',
        owner_id: 'alice',
        deleted_at: '2026-01-01T00:00:00.000Z',
      },
      {
        actorId: 'alice',
        deviceId: 'd',
        accountId: null,
        isAnon: false,
      },
      db
    );

    expect(queries).toBe(0);
    expect(topics).toEqual([userTopic('alice')]);
  });
});
