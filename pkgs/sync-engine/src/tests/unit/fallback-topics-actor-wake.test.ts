import { describe, expect, test } from 'bun:test';
import type { Topic } from '@pkgs/pubsub/interface';

import { defineTopicMap, topicsFromWriteCapture } from '../../shared/topic-map';

const map = defineTopicMap({
  spaces_open_sessions: {
    topics() {
      return [] as Topic[];
    },
    fallbackTopics() {
      return [] as Topic[];
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
  test('spaces_open_sessions touch without images stays device-private', async () => {
    const topics = await topicsFromWriteCapture({
      topicMap: map,
      ctx: {
        actorId: 'actor-1',
        deviceId: 'dev-1',
        accountId: null,
        isAnon: false,
      },
      capture: {
        tables: ['spaces_open_sessions'],
        ids: {},
        images: {},
      },
    });
    expect(topics).toEqual([]);
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
