import { describe, expect, test } from 'bun:test';
import { topicsFromWriteCapture } from '@pkgs/sync-engine/shared';
import {
  acmeSystem,
  acmeTopicMap,
  addClient,
  createSpace,
  expectConverged,
  hasTopic,
  joinSpace,
  lacksTopic,
  leaveSpace,
  mutate,
  roomTopic,
  SPACE_MEMBERSHIP_SESSION,
  subscribedTopics,
  untilAcme,
  userTopic,
} from '../apps/acme';

describe('tombstone membership wakes removed user topic', () => {
  test('spaces_users tombstone post-image still maps to removed user topic', async () => {
    const topics = await topicsFromWriteCapture({
      topicMap: acmeTopicMap,
      ctx: {
        actorId: 'alice',
        deviceId: 'd1',
        accountId: null,
        isAnon: false,
      },
      capture: {
        tables: ['spaces_users'],
        ids: { spaces_users: ['room-1:bob'] },
        images: {
          spaces_users: [
            {
              id: 'room-1:bob',
              space_id: 'room-1',
              user_id: 'bob',
              deleted_at: '2026-01-01T00:00:00.000Z',
            },
          ],
        },
      },
    });
    expect(topics).toContain(userTopic('bob'));
    expect(topics).toContain(roomTopic('room-1'));
  });

  test('leave soft-delete converges peers and drops leaver room topic', async () => {
    await using s = await acmeSystem.script({
      seed: 1201,
      args: {
        clientCount: 0,
      },
    });

    await s.apply(addClient, {
      id: 'alice',
      sessionQuery: SPACE_MEMBERSHIP_SESSION,
    });
    await s.apply(addClient, {
      id: 'bob',
      sessionQuery: SPACE_MEMBERSHIP_SESSION,
    });

    await s.apply(mutate, 'alice', createSpace, {
      id: 'tomb-room',
      title: 'T',
    });
    await s.apply(mutate, 'bob', joinSpace, { spaceId: 'tomb-room' });
    await expectConverged(s);
    await untilAcme(s, (s) => subscribedTopics(s, 'bob'), {
      pred: hasTopic(roomTopic('tomb-room')),
    });

    await s.apply(mutate, 'bob', leaveSpace, { spaceId: 'tomb-room' });
    await untilAcme(s, (s) => subscribedTopics(s, 'bob'), {
      pred: lacksTopic(roomTopic('tomb-room')),
    });
    await expectConverged(s);
    expect(await s.observe(subscribedTopics, 'alice')).toContain(
      roomTopic('tomb-room')
    );
  });
});
