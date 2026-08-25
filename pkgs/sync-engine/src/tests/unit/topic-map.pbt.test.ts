import { describe, expect, test } from 'bun:test';
import { assertProperty, fc } from '@pkgs/pbt';

import {
  defineTopicMap,
  type TopicMapCtx,
  topicsFromWriteCapture,
} from '../../shared/topic-map';

const ctx: TopicMapCtx = {
  actorId: 'actor',
  deviceId: 'device',
  accountId: 'acct',
  isAnon: false,
};

describe('topicsFromWriteCapture properties', () => {
  test('topics are deduped and code-unit sorted', async () => {
    await assertProperty(
      'topics deduped + sorted',
      fc.asyncProperty(
        fc.array(fc.stringMatching(/^[a-z]{2,8}$/), {
          minLength: 1,
          maxLength: 8,
        }),
        async (rawTopics) => {
          const topicMap = defineTopicMap({
            notes: {
              topics: (row) => [
                `note:${String(row['id'] ?? 'x')}`,
                ...rawTopics,
                ...rawTopics,
              ],
              fallbackTopics: () => ['fallback'],
            },
          });
          const topics = await topicsFromWriteCapture({
            topicMap,
            capture: {
              tables: ['notes'],
              images: { notes: [{ id: '1' }, { id: '2' }] },
              ids: {},
            },
            ctx,
          });
          expect(topics).toEqual([...topics].sort((a, b) => (a < b ? -1 : 1)));
          expect(new Set(topics).size).toBe(topics.length);
        }
      )
    );
  });

  test('same capture is idempotent', async () => {
    await assertProperty(
      'topicsFromWriteCapture idempotent',
      fc.asyncProperty(fc.stringMatching(/^[a-z]{3,8}$/), async (prefix) => {
        const topicMap = defineTopicMap({
          notes: {
            topics: (row) => [`${prefix}:${String(row['id'])}`],
          },
        });
        const capture = {
          tables: ['notes'] as const,
          images: { notes: [{ id: 'a' }, { id: 'b' }] },
          ids: {},
        };
        const once = await topicsFromWriteCapture({ topicMap, capture, ctx });
        const twice = await topicsFromWriteCapture({ topicMap, capture, ctx });
        expect(once).toEqual(twice);
      })
    );
  });
});
