import { describe, expect, test } from 'bun:test';
import {
  createSpace,
  leaveSpace,
  roomTopic,
  SPACE_MEMBERSHIP_SESSION,
} from '../apps/acme';
import { openAcmeWorld } from '../apps/acme/system';

describe('topic sync waits for mutations drain', () => {
  test('topic sync waits until pending mutations drain', async () => {
    await using world = await openAcmeWorld({
      seed: 803,
      knobs: {
        clientCount: 0,
      },
    });

    const a = await world.addClient({
      id: 'alice',
      sessionQuery: SPACE_MEMBERSHIP_SESSION,
    });
    await a.mutate(createSpace, { id: 'gated', title: 'G' });
    await world.assertConverged();
    await world.waitUntil(() =>
      a.subscribedTopics().includes(roomTopic('gated'))
    );

    {
      using _hold = world.net('alice', 'sync').set('hold');
      await a.mutate(leaveSpace, { spaceId: 'gated' });
      await world.advance(300);
      // Upload held → membership sync must not drop room topic yet.
      expect(a.subscribedTopics()).toContain(roomTopic('gated'));
    }
    await world.waitUntil(
      () => !a.subscribedTopics().includes(roomTopic('gated'))
    );
    expect(a.subscribedTopics()).not.toContain(roomTopic('gated'));
    await world.assertConverged();
  });
});
