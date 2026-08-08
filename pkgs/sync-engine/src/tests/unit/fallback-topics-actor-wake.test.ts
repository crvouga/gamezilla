import { describe, expect, test } from 'bun:test';
import type { Topic } from '@pkgs/pubsub/interface';

import { defineTopicMap, topicsFromWriteCapture } from '../../shared/topic-map';

const map = defineTopicMap({
  space_open_sessions: {
    topics(_row, ctx) {
      return [`user:${ctx.actorId}` as Topic];
    },
    fallbackTopics(ctx) {
      return [`user:${ctx.actorId}` as Topic];
    },
  },
  client_config: {
    topics() {
      return ['system:client_config' as Topic];
    },
    fallbackTopics() {
      return ['system:client_config' as Topic];
    },
  },
});

describe('fallbackTopics actor wake', () => {
  test('space_open_sessions touch without images uses fallbackTopics', async () => {
    const topics = await topicsFromWriteCapture({
      topicMap: map,
      ctx: {
        actorId: 'actor-1',
        deviceId: 'dev-1',
        accountId: null,
        isAnon: false,
      },
      capture: {
        tables: ['space_open_sessions'],
        ids: {},
        images: {},
      },
    });
    expect(topics).toEqual(['user:actor-1']);
  });

  test('client_config touch without images uses system fallback', async () => {
    const topics = await topicsFromWriteCapture({
      topicMap: map,
      ctx: {
        actorId: 'actor-1',
        deviceId: 'dev-1',
        accountId: null,
        isAnon: false,
      },
      capture: {
        tables: ['client_config'],
        ids: {},
        images: {},
      },
    });
    expect(topics).toEqual(['system:client_config']);
  });
});
