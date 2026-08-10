import { describe, expect, test } from 'bun:test';
import type { Topic } from '@pkgs/pubsub/interface';

import { defineTopicMap, topicsFromWriteCapture } from '../../shared/topic-map';

const map = defineTopicMap({
  friendships: {
    topics(row) {
      return [
        `user:${String(row['user_low'])}` as Topic,
        `user:${String(row['user_high'])}` as Topic,
      ];
    },
  },
  friend_requests: {
    topics(row) {
      return [
        `user:${String(row['from_user_id'])}` as Topic,
        `user:${String(row['to_user_id'])}` as Topic,
      ];
    },
  },
});

describe('friendship topic map wakes both users', () => {
  test('acceptFriendRequest-shaped capture wakes both users', async () => {
    const topics = await topicsFromWriteCapture({
      topicMap: map,
      ctx: {
        actorId: 'alice',
        deviceId: 'd',
        accountId: null,
        isAnon: false,
      },
      capture: {
        tables: ['friendships', 'friend_requests'],
        ids: {
          friendships: ['f1'],
          friend_requests: ['r1'],
        },
        images: {
          friendships: [
            {
              id: 'f1',
              user_low: 'alice',
              user_high: 'bob',
              deleted_at: null,
            },
          ],
          friend_requests: [
            {
              id: 'r1',
              from_user_id: 'bob',
              to_user_id: 'alice',
              deleted_at: '2026-01-01T00:00:00.000Z',
            },
          ],
        },
      },
    });
    expect(topics).toContain('user:alice');
    expect(topics).toContain('user:bob');
  });
});
