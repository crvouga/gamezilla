import { describe, expect, test } from 'bun:test';
import { script } from '@pkgs/dst';
import { topicsFromWriteCapture } from '@pkgs/sync-engine/shared';
import {
  acmeKnobs,
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
  syncVirtualHost,
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
    await using run = await script(acmeSystem, {
      seed: 1201,
      host: syncVirtualHost(),
      knobs: acmeKnobs({
        clientCount: 0,
      }),
      properties: [],
    });

    await run.apply(addClient, {
      id: 'alice',
      sessionQuery: SPACE_MEMBERSHIP_SESSION,
    });
    await run.apply(addClient, {
      id: 'bob',
      sessionQuery: SPACE_MEMBERSHIP_SESSION,
    });

    await run.apply(mutate, 'alice', createSpace, {
      id: 'tomb-room',
      title: 'T',
    });
    await run.apply(mutate, 'bob', joinSpace, { spaceId: 'tomb-room' });
    await expectConverged(run);
    await untilAcme(run, subscribedTopics('bob'), {
      pred: hasTopic(roomTopic('tomb-room')),
    });

    await run.apply(mutate, 'bob', leaveSpace, { spaceId: 'tomb-room' });
    await untilAcme(run, subscribedTopics('bob'), {
      pred: lacksTopic(roomTopic('tomb-room')),
    });
    await expectConverged(run);
    expect(await run.observe(subscribedTopics('alice'))).toContain(
      roomTopic('tomb-room')
    );
  });
});
