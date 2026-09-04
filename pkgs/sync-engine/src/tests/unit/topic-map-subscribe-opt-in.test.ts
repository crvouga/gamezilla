import { describe, expect, test } from 'bun:test';

import {
  filterPublishableImages,
  subscribeTables,
  topicsFromHeldRows,
} from '../../shared';
import { defineTopicMap } from '../../shared/topic-map';

describe('subscribeTopics opt-in', () => {
  test('subscribeTables only lists entries with subscribeTopics', () => {
    const map = defineTopicMap({
      items: {
        topics() {
          return ['user:all'];
        },
      },
      memberships: {
        topics(row) {
          return [`group:${String(row['group_id'] ?? '')}`];
        },
        subscribeTopics(row, ctx) {
          if (row['user_id'] !== ctx.actorId) return [];
          const id = String(row['group_id'] ?? '');
          return id.length > 0 ? [`group:${id}`] : [];
        },
      },
    });
    expect([...subscribeTables(map)].sort()).toEqual(['memberships']);
  });

  test('topicsFromHeldRows ignores tables without subscribeTopics', () => {
    const map = defineTopicMap({
      items: {
        topics() {
          return ['user:firehose'];
        },
      },
      memberships: {
        topics() {
          return ['group:ignored-async-path'];
        },
        subscribeTopics(row, ctx) {
          if (row['user_id'] !== ctx.actorId) return [];
          return [`group:${String(row['group_id'])}`];
        },
      },
    });
    const topics = topicsFromHeldRows({
      topicMap: map,
      liveRowsByTable: {
        items: [{ id: 'i1', deleted_at: null }],
        memberships: [
          { id: 'm1', group_id: 'g1', user_id: 'actor_a', deleted_at: null },
          { id: 'm2', group_id: 'g2', user_id: 'peer', deleted_at: null },
        ],
      },
      entryTopics: ['user:actor_a'],
      ctx: {
        actorId: 'actor_a',
        deviceId: '',
        accountId: null,
        isAnon: false,
      },
    });
    expect(topics).toEqual(['group:g1', 'user:actor_a']);
  });
});

describe('rowImage publish guard', () => {
  test('filterPublishableImages drops vetoed rows', () => {
    const map = defineTopicMap({
      identity: {
        topics(row) {
          return [`user:${String(row['id'] ?? '')}`];
        },
        rowImage: {
          publish(row) {
            const handle = row['handle'];
            return typeof handle === 'string' && handle.length > 0;
          },
        },
      },
    });
    const rows = filterPublishableImages(
      {
        identity: [
          { id: 'a', handle: '' },
          { id: 'b', handle: 'bob' },
        ],
      },
      map,
      { actorId: 'a', deviceId: '', accountId: null, isAnon: false }
    );
    expect(rows).toEqual({ identity: [{ id: 'b', handle: 'bob' }] });
  });
});
