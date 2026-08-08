import { describe, expect, test } from 'bun:test';
import type { Topic } from '@pkgs/pubsub/interface';
import { notesTopicMap, userTopic } from '../../domain-packs/notes-app';
import { partitionFanoutRowsByTopic } from '../../shared/partition-fanout-rows';
import { defineTopicMap } from '../../shared/topic-map';

describe('partitionFanoutRowsByTopic', () => {
  test('keeps device-private rows off user topic when map returns empty', async () => {
    const topicMap = defineTopicMap({
      spaces: {
        topics(row) {
          return [`user:${String(row['host_account_id'])}` as Topic];
        },
      },
      space_open_sessions: {
        topics() {
          return [];
        },
      },
    });
    const partitioned = await partitionFanoutRowsByTopic({
      topicMap,
      ctx: {
        actorId: 'acct-1',
        deviceId: 'dev-a',
        accountId: 'acct-1',
        isAnon: false,
      },
      rows: {
        spaces: [
          {
            id: 'space-1',
            host_account_id: 'acct-1',
          },
        ],
        space_open_sessions: [
          {
            id: 'dev-a:space-1',
            space_id: 'space-1',
            device_id: 'dev-a',
          },
        ],
      },
    });
    expect([...partitioned.keys()]).toEqual(['user:acct-1']);
    const userRows = partitioned.get('user:acct-1' as Topic);
    expect(userRows?.['spaces']?.length).toBe(1);
    expect(userRows?.['space_open_sessions']).toBeUndefined();
  });

  test('notes topic-map partition keeps open sessions off user wake bag', async () => {
    const partitioned = await partitionFanoutRowsByTopic({
      topicMap: notesTopicMap,
      ctx: {
        actorId: 'user-1',
        deviceId: 'device:phone',
        accountId: 'acct:user-1',
        isAnon: false,
      },
      rows: {
        spaces: [{ id: 'room-1', title: 'T', owner_id: 'user-1' }],
        space_users: [
          { id: 'room-1:user-1', space_id: 'room-1', user_id: 'user-1' },
        ],
        space_open_sessions: [
          {
            id: 'device:phone:room-1',
            space_id: 'room-1',
            device_id: 'device:phone',
            opened_at: '2026-01-01T00:00:00.000Z',
          },
        ],
      },
    });

    const userBag = partitioned.get(userTopic('user-1'));
    expect(userBag?.['spaces']?.length).toBe(1);
    expect(userBag?.['space_users']?.length).toBe(1);
    expect(userBag?.['space_open_sessions']).toBeUndefined();
  });
});
