import { describe, expect, test } from 'bun:test';
import { topicsFromWriteCapture } from '@pkgs/sync-engine/shared';
import { openWorld } from '../../sim/world';
import {
  acmeDomainPack,
  acmeTopicMap,
  createSpace,
  joinSpace,
  leaveSpace,
  roomTopic,
  SPACE_MEMBERSHIP_SESSION,
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
    await using world = await openWorld({
      domain: acmeDomainPack,
      seed: 1201,
    });
    const a = await world.addClient({
      id: 'alice',
      sessionQuery: SPACE_MEMBERSHIP_SESSION,
    });
    const b = await world.addClient({
      id: 'bob',
      sessionQuery: SPACE_MEMBERSHIP_SESSION,
    });

    await a.mutate(createSpace, { id: 'tomb-room', title: 'T' });
    await b.mutate(joinSpace, { spaceId: 'tomb-room' });
    await world.assertConverged();
    await world.until(() =>
      b.subscribedTopics().includes(roomTopic('tomb-room'))
    );

    await b.mutate(leaveSpace, { spaceId: 'tomb-room' });
    await world.until(
      () => !b.subscribedTopics().includes(roomTopic('tomb-room'))
    );
    await world.assertConverged();
    expect(a.subscribedTopics()).toContain(roomTopic('tomb-room'));
  });
});
